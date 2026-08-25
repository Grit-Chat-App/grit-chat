# CHop: the compiled Hop core (libhop.xcframework) as a pod. DEV PIN at hop main 54a2e82.
#
# WHAT REPLACED THE v0.0.2 PIN, AND WHY. The published hop-sdk-apple v0.0.2 release ships an
# ABI v5 libhop with no hps:// (channels) exports at all, and this branch adds channels to the
# app. Channels shipped in hop PR #62 (C ABI 5 to 6) and are on main, but NO hop-sdk-apple
# release carries them yet. So this pod is pinned, for development only, to a locally built
# artifact:
#
#   source   vendor/libhop-main-54a2e82.xcframework.zip
#   built    bash sdk/apple/build-xcframework.sh, in a hop worktree at origin/main 54a2e82
#   verified hop_abi_version() == 6, hop_hps_register + hop_relay_add present in the slices
#   sha256   a88b346646ceb34164d45ec32554e6a4b10a9efab09fd6ea1e31baf89b0539eb
#
# This is a DEVELOPMENT DEPENDENCY, plainly: shipping Grit Chat with channels requires a new
# published hop-sdk-apple release, which does not exist yet. When it does, restore this pod to
# the release-asset form recorded in git history (v0.0.2 pin, :http + :sha256 on the GitHub
# release URL) at the new tag. The full story is in ios/hop-pods/README.md and PATH.md.

zip_path = File.join(__dir__, "..", "..", "..", "vendor", "libhop-main-54a2e82.xcframework.zip")
raise "CHop.podspec: dev framework zip missing at #{zip_path} (see ios/hop-pods/README.md)" unless File.exist?(zip_path)

Pod::Spec.new do |s|
  s.name = "CHop"
  s.version = "0.0.2-dev.1"
  s.summary = "The compiled Hop core (libhop, ABI 6 with hps://) as a local development xcframework."
  s.homepage = "https://github.com/hopmesh/hop"
  s.license = {:type => "Apache-2.0", :text => File.read(File.join(__dir__, "..", "LICENSE.md"))}
  s.authors = {"Hop Mesh, LLC" => "jason@waldrip.net"}
  s.platforms = {:ios => "16.0", :osx => "13.0"}

  # file:// so CocoaPods fetches the local zip through the same vendored-frameworks path the
  # release asset uses. The sha256 still verifies the bytes, so a substituted artifact fails
  # loudly even in development.
  s.source = {
    :http => "file://#{zip_path}",
    :sha256 => "a88b346646ceb34164d45ec32554e6a4b10a9efab09fd6ea1e31baf89b0539eb",
  }
  s.vendored_frameworks = "libhop.xcframework"

  # No manual link flags on purpose; see the v0.0.2 spec in git history for the full account of
  # static-library slice selection and why the wrapper pod must not be named Hop.
end
