// swift-tools-version:5.9
import PackageDescription

// This package now exists for ONE thing: grit-relay-node, the proof harness. The consumer app is
// the React Native tree (ios/, src/), and the Swift app that once lived here is deleted; its
// loopback proof was strictly weaker than what the React Native path has now crossed a real relay
// from a physical iPhone, and no second path should stay in the repo unmaintained.
//
// GritChat is a CONSUMER of Hop, not a part of it: nothing here forks or reaches into the mesh
// source tree. Hop arrives as a dependency, and the dependency is pinned EXACTLY rather than with
// `from:`, so the contract this repo compiles against is the contract a reviewer can read.
//
// DEV PIN. The published pin below is replaced, on this branch only, by a local package:
//   vendor/hop-sdk-dev, whose Swift + libhop come from hop main 54a2e82 (ABI 6, the hps://
//   channel surface). Channels are not in ANY published hop-sdk-apple release yet, and
// grit-relay-node needs hps calls to be the channel proof's second node. Same story as the
// dev CocoaPods in ios/hop-pods/README.md. Revert to the v0.0.2 remote pin when a release
// ships ABI 6:
//     .package(url: "https://github.com/hopmesh/hop-sdk-apple.git", exact: "0.0.2"),
let package = Package(
    name: "GritChat",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .executable(name: "grit-relay-node", targets: ["GritRelayNode"]),
    ],
    dependencies: [
        .package(path: "vendor/hop-sdk-dev"),
    ],
    targets: [
        .executableTarget(
            name: "GritRelayNode",
            dependencies: [
                .product(name: "Hop", package: "hop-sdk-dev"),
                .product(name: "HopContract", package: "hop-sdk-dev"),
            ]
        ),
    ]
)
