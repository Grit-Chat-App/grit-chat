// A matching-core Hop node for the proof ladder, listen or send.
//
// Not a product feature. The app is pinned to hop-sdk-apple v0.0.2. A HEAD-core harness
// completes Noise with the app over the relay and then never delivers, while HEAD-to-HEAD
// on the same relay does. So the second party, and the control that isolates whether the
// app is the broken party, must speak the same core as the app.
//
// Usage:
//   grit-relay-node listen <ws-url>
//   grit-relay-node send   <ws-url> <peer-base58> <nonce>
//
// listen prints the address and one INBOX line per message, and holds the link.
// send publishes a prekey, sends "grit proof <nonce>" with requestAck, polls status,
// and exits 0 only when delivered is true and forwardHops is greater than one.

import Foundation
import Hop
import HopContract

let args = CommandLine.arguments
guard args.count >= 3, ["listen", "send", "send-media", "peer-media", "channel-peer", "invitee"].contains(args[1]) else {
    fputs("usage: grit-relay-node listen <ws-url>\n", stderr)
    fputs("       grit-relay-node send   <ws-url> <peer-base58> <nonce>\n", stderr)
    fputs("       grit-relay-node send-media <ws-url> <peer-base58> <file> <content-type>\n", stderr)
    fputs("       grit-relay-node peer-media <ws-url> <peer-base58> <file> <content-type>\n", stderr)
    fputs("       grit-relay-node channel-peer <ws-url> <host-base58> <path> [reply-body]\n", stderr)
    fputs("       grit-relay-node invitee <ws-url> <path> [reply-body]\n", stderr)
    exit(2)
}

let mode = args[1]
guard let url = URL(string: args[2]) else {
    fputs("not a URL: \(args[2])\n", stderr)
    exit(2)
}

var peerAddr: Data?
var nonce = "NO-NONCE"
var mediaFile = ""
var mediaType = "application/octet-stream"
if mode == "send" {
    guard args.count >= 5, let decoded = HopAddress.fromBase58(args[3]) else {
        fputs("send needs a 32-byte base58 peer address\n", stderr)
        exit(2)
    }
    peerAddr = decoded
    nonce = args[4]
}
if mode == "send-media" || mode == "peer-media" {
    guard args.count >= 6, let decoded = HopAddress.fromBase58(args[3]) else {
        fputs("\(mode) needs <ws-url> <peer-base58> <file> <content-type>\n", stderr)
        exit(2)
    }
    peerAddr = decoded
    mediaFile = args[4]
    mediaType = args[5]
}

// channel-peer: subscribe to hps://{host}/{path}, print what arrives, publish one reply back.
var channelHost: Data?
var channelPath = ""
var channelReply = "grit channel reply"
if mode == "invitee" {
    // Parsed here, BEFORE ChannelPeerState captures it: assigning it in the runtime block left the
    // state holding the default, which is why the invitee's replies carried the wrong body.
    channelPath = args.count >= 4 ? args[3] : channelPath
    if args.count >= 5 { channelReply = args[4] }
}
if mode == "channel-peer" {
    guard args.count >= 5, let decoded = HopAddress.fromBase58(args[3]) else {
        fputs("channel-peer needs <ws-url> <host-base58> <path> [reply-body]\n", stderr)
        exit(2)
    }
    channelHost = decoded
    channelPath = args[4]
    if args.count >= 6 { channelReply = args[5] }
}

guard let node = HopNode.ephemeral() else {
    fputs("FAIL: HopNode.ephemeral() returned nil\n", stderr)
    exit(1)
}

print("\(mode) address \(HopAddress.base58(node.address))")
fflush(stdout)

let opened = DispatchSemaphore(value: 0)
let bearer = RelayWsBearer(
    url: url,
    onBytes: { bytes in
        node.bytesReceived(1000, bytes)
    },
    onOpen: {
        node.linkUp(1000, role: .dialer)
        let published = node.publishPrekey()
        print("ws open, link_up dialer, prekey published=\(published)")
        fflush(stdout)
        opened.signal()
    },
    onFail: { reason in
        fputs("ws failed: \(reason)\n", stderr)
        exit(1)
    }
)
bearer.start()

if opened.wait(timeout: .now() + 15) == .timedOut {
    fputs("FAIL: no open within 15s\n", stderr)
    exit(1)
}

// channel-peer's bookkeeping, created for every mode (a no-op elsewhere) so the single pump
// below can always reference it without optionals.
let channelState = ChannelPeerState(replyBody: channelReply)
let pumpStart = Date()
// Isolation seam, default off: HOP_HPS_POLL_AFTER delays the first hps poll by N seconds. Used to
// prove the hps polls were NOT what dropped the relay socket (a stale relay closes every new
// connection about 300ms after accept, in listen mode too).
let hpsPollAfterSeconds = Double(ProcessInfo.processInfo.environment["HOP_HPS_POLL_AFTER"] ?? "0") ?? 0


let pump = DispatchSource.makeTimerSource(queue: .global())
pump.schedule(deadline: .now(), repeating: .milliseconds(40))
pump.setEventHandler {
    node.tick(nowMs: UInt64(Date().timeIntervalSince1970 * 1000))
    node.drainOutgoing { link, bytes in
        guard link == 1000 else { return }
        bearer.send(bytes)
    }
    node.pollInboxAccepting { message in
        let body = String(data: message.body, encoding: .utf8) ?? "<\(message.body.count) bytes>"
        let from = HopAddress.base58(message.from)
        print("INBOX from=\(from) hops=\(message.hops) accepted=true body=\(body)")
        fflush(stdout)
        return true
    }
    if mode == "channel-peer" || mode == "invitee" {
        channelState.maybeReportStatus(node: node, path: channelPath)
    }
    if mode == "channel-peer" || mode == "invitee", Date().timeIntervalSince(pumpStart) >= hpsPollAfterSeconds {
        // Same timer, same thread: the core's C ABI is not safe under concurrent tick(), so the
        // hps polls join the ONE pump rather than adding a second one.
        node.pollHpsMessagesAccepting { message in
            channelState.onPublication(message: message)
        }
        channelState.maybeReply(node: node, path: channelPath)
        // Invites are take-and-clear: drain them here and accept, because a peer in a test
        // scenario has nobody to tap accept. Declining is a human decision, so this mode always
        // accepts.
        node.pollHpsInvites { invite in
            print("INVITE from=\(HopAddress.base58(invite.host)) path=\(invite.path)")
            fflush(stdout)
            if let id = node.hpsAcceptInvite(host: invite.host, path: invite.path) {
                print("ACCEPTED invite id=\(id.map { String(format: "%02x", $0) }.joined())")
            } else {
                print("FAILED to accept invite")
            }
            fflush(stdout)
        }
    }
}
pump.resume()

if mode == "peer-media" {
    // One address, both roles: it printed its address like listen does (the scenario adds THAT
    // as the contact), then it sends the media to the app and holds. A send-media node is a
    // different ephemeral identity, so media it sends lands in a conversation the scenario is
    // not looking at: this mode exists because the earlier flow proved exactly that failure.
    guard let dest = peerAddr else {
        fputs("FAIL: peer-media without a destination\n", stderr)
        exit(1)
    }
    guard let bytes = FileManager.default.contents(atPath: mediaFile) else {
        fputs("FAIL: could not read \(mediaFile)\n", stderr)
        exit(1)
    }
    // Settle first: the prekey and link handshake must be real before anything sealed travels.
    Thread.sleep(forTimeInterval: 2)
    guard let id = node.send(to: dest, contentType: mediaType, body: bytes, requestAck: true) else {
        fputs("FAIL: media send returned nil\n", stderr)
        exit(1)
    }
    print("media \(mediaType) \(bytes.count) bytes id=\(id.map { String(format: "%02x", $0) }.joined())")
    fflush(stdout)
    let deadline = Date().addingTimeInterval(45)
    var last = node.status(of: id)
    while Date() < deadline {
        last = node.status(of: id)
        if last.delivered { break }
        Thread.sleep(forTimeInterval: 0.5)
    }
    print("\(last.delivered ? "PASS" : "FAIL"): delivered=\(last.delivered) relayed=\(last.relayed) forwardHops=\(last.forwardHops)")
    fflush(stdout)
    // Hold the link so the app's own sends to this address still have somewhere to go.
    dispatchMain()
}

if mode == "invitee" {
    // An invite-only channel hands the content key out ONLY through hpsInvite + accept, so this
    // mode never subscribes: it waits, accepts any invite that arrives, and reports membership.
    channelPath = args.count >= 4 ? args[3] : channelPath
    print("invitee waiting for invites path=\(channelPath)")
    fflush(stdout)
    dispatchMain()
}

if mode == "channel-peer" {
    guard let host = channelHost else {
        fputs("FAIL: channel-peer without a host\n", stderr)
        exit(1)
    }
    // Settle before the first hps call, for the same reason `send` mode sleeps here: the WS being
    // open is NOT the link being usable, because the link's Noise XX handshake runs inside the node
    // over this socket. The join request is only worth sending once that can carry it.
    Thread.sleep(forTimeInterval: 2)

    // Subscribe through the same relay door. Keys arrive asynchronously; publishing waits until
    // the topic shows up in hpsMyTopics, which is when membership is real. The single pump above
    // polls hps and drives the reply; a second timer would race the core's C ABI under concurrent
    // tick(), so there is exactly one pump.
    guard let subId = node.hpsSubscribe(host: host, path: channelPath) else {
        fputs("FAIL: hpsSubscribe returned nil (could not seal the join request)\n", stderr)
        exit(1)
    }
    print("subscribe id=\(subId.map { String(format: "%02x", $0) }.joined()) path=\(channelPath)")
    fflush(stdout)
    dispatchMain()
}

if mode == "listen" {
    dispatchMain()
}

// send and send-media: give the directory a moment to carry this node's prekey and the peer's,
// then send. Untraceable send needs the recipient's prekey. A send that returns nil is the honest
// "could not seal" signal; a returned id with relayed=0 is a queued bundle with no route.
Thread.sleep(forTimeInterval: 2)

var body = Data("grit proof \(nonce)".utf8)
var contentType = "text/plain"
if mode == "send-media" {
    guard let bytes = FileManager.default.contents(atPath: mediaFile) else {
        fputs("FAIL: could not read \(mediaFile)\n", stderr)
        exit(1)
    }
    body = bytes
    contentType = mediaType
    print("media \(contentType) \(bytes.count) bytes from \(mediaFile)")
    fflush(stdout)
}
guard let dest = peerAddr, let id = node.send(to: dest, contentType: contentType, body: body, requestAck: true) else {
    print("FAIL: send returned nil (could not seal; recipient prekey unresolved is the usual cause)")
    exit(1)
}
print("sent id=\(id.map { String(format: "%02x", $0) }.joined()) body=\"grit proof \(nonce)\"")
fflush(stdout)

let deadline = Date().addingTimeInterval(60)
var last = node.status(of: id)
while Date() < deadline {
    last = node.status(of: id)
    print(
        "status relayed=\(last.relayed) delivered=\(last.delivered) hops=\(last.forwardHops) ms=\(last.forwardMs)"
    )
    fflush(stdout)
    if last.delivered { break }
    Thread.sleep(forTimeInterval: 1)
}

let pass = last.delivered && last.forwardHops > 1
print(
    "\(pass ? "PASS" : "FAIL"): delivered=\(last.delivered) relayed=\(last.relayed) forwardHops=\(last.forwardHops) forwardMs=\(last.forwardMs)"
)
exit(pass ? 0 : 1)

/// One core packet per WebSocket binary frame, matching hop-relayd's documented WS door and the
/// RN app's relayBearer.ts. No length prefix, no hello, no envelope.
final class RelayWsBearer {
    private let url: URL
    private let onBytes: (Data) -> Void
    private let onOpen: () -> Void
    private let onFail: (String) -> Void
    private var task: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .ephemeral)
    private var finished = false
    private var opened = false

    init(
        url: URL,
        onBytes: @escaping (Data) -> Void,
        onOpen: @escaping () -> Void,
        onFail: @escaping (String) -> Void
    ) {
        self.url = url
        self.onBytes = onBytes
        self.onOpen = onOpen
        self.onFail = onFail
    }

    func start() {
        let task = session.webSocketTask(with: url)
        self.task = task
        task.resume()
        receiveLoop(task)
        task.sendPing { [weak self] error in
            guard let self, !self.finished, !self.opened else { return }
            if let error {
                self.fail("ping failed: \(error.localizedDescription)")
            } else {
                self.opened = true
                self.onOpen()
            }
        }
    }

    func send(_ bytes: Data) {
        guard !finished else { return }
        task?.send(.data(bytes)) { [weak self] error in
            if let error {
                self?.fail("send failed: \(error.localizedDescription)")
            }
        }
    }

    private func receiveLoop(_ task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            guard let self, !self.finished else { return }
            switch result {
            case .failure(let error):
                self.fail("receive failed: \(error.localizedDescription)")
            case .success(.data(let bytes)):
                self.onBytes(bytes)
                self.receiveLoop(task)
            case .success(.string):
                fputs("ignored a non-binary frame\n", stderr)
                self.receiveLoop(task)
            @unknown default:
                self.receiveLoop(task)
            }
        }
    }

    private func fail(_ reason: String) {
        guard !finished else { return }
        finished = true
        task?.cancel(with: .goingAway, reason: nil)
        onFail(reason)
    }
}


/// channel-peer's bookkeeping: print each publication once (the poll repeats until accepted),
/// accept it after printing, and publish one reply once membership is real.
final class ChannelPeerState {
    private let replyBody: String
    private var seen = Set<Data>()
    private var receivedAny = false
    private var replied = false
    private var lastStatusAt = Date.distantPast
    private let lock = NSLock()

    init(replyBody: String) {
        self.replyBody = replyBody
    }

    func onPublication(message: HopHpsMessage) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !seen.contains(message.id) else { return true }
        seen.insert(message.id)
        receivedAny = true
        let body = String(data: message.body, encoding: .utf8) ?? "<\(message.body.count) bytes>"
        print("HPSINBOX from=\(HopAddress.base58(message.sender)) path=\(message.path) body=\(body)")
        fflush(stdout)
        // Returning true accepts it durably, so the core stops repeating it.
        return true
    }

    /// Say whether membership became real, every few seconds.
    ///
    /// This is the peer half of the join-handoff discriminator: a subscriber only holds the content
    /// key once the host has handed it over, and until then it is silent no matter how well
    /// publications route. `joined=false` forever means the handoff never completed.
    func maybeReportStatus(node: HopNode, path: String) {
        lock.lock()
        let due = Date().timeIntervalSince(lastStatusAt) >= 5
        if due { lastStatusAt = Date() }
        let received = receivedAny
        let didReply = replied
        lock.unlock()
        guard due else { return }
        let topics = node.hpsMyTopics()
        let joined = topics.contains { $0.path == path && !$0.hosting }
        print(
            "status joined=\(joined) topics=\(topics.count) received=\(received) replied=\(didReply)"
        )
        fflush(stdout)
    }

    func maybeReply(node: HopNode, path: String) {
        lock.lock()
        defer { lock.unlock() }
        guard receivedAny, !replied else { return }
        // Membership is real only once the node's own topic list carries the channel.
        let joined = node.hpsMyTopics().contains { $0.path == path && !$0.hosting }
        guard joined else { return }
        guard let id = node.hpsPublish(path: path, body: Data(replyBody.utf8)) else {
            fputs("FAIL: hpsPublish returned nil\n", stderr)
            exit(1)
        }
        replied = true
        print("reply id=\(id.map { String(format: "%02x", $0) }.joined()) body=\"\(replyBody)\"")
        fflush(stdout)
    }
}
