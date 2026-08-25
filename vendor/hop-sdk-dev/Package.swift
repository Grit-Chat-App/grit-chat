// swift-tools-version:5.9
import PackageDescription

// A LOCAL DEVELOPMENT SwiftPM package mirroring the dev CocoaPods in ios/hop-pods: the Swift
// sources and libhop binary from hop main 54a2e82 (ABI 6, the hps:// surface), which no
// published hop-sdk-apple release carries yet. The root Package.swift points grit-relay-node at
// this package for the same reason the pods are pinned locally: the channel proof harness needs
// hps calls, and v0.0.2 does not have them.
//
// The xcframework is NOT committed here; run scripts/fetch-framework.sh once to unzip the
// canonical artifact from vendor/ into Frameworks/ (gitignored). Single source of truth, no
// second binary copy in git. Revert plan: ios/hop-pods/README.md.
let package = Package(
    name: "Hop",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "HopContract", targets: ["HopContract"]),
        .library(name: "Hop", targets: ["Hop"]),
    ],
    targets: [
        .target(name: "HopContract"),
        .binaryTarget(name: "CHop", path: "Frameworks/libhop.xcframework"),
        .target(name: "Hop", dependencies: ["CHop", "HopContract"]),
    ]
)
