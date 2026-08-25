# HopSDK: the Apple client SDK, vendored from hop main 54a2e82. The MODULE it exposes is `Hop`.
#
# Consumed with :path, so s.source is never read; the Swift beside this spec IS the source. This
# is the hps:// (channels + relay pool) surface, which no published hop-sdk-apple release carries
# yet. See ios/hop-pods/README.md for the dependency story and the revert plan.
#
# WHY THE POD IS NOT CALLED `Hop`: a pod named Hop builds libHop.a, which collides with the
# core's libhop.a on a case-insensitive volume and makes -l resolve the wrong archive. HopSDK
# builds libHopSDK.a, which cannot collide. Do not rename it back.

Pod::Spec.new do |s|
  s.name = "HopSDK"
  s.module_name = "Hop"
  s.version = "0.0.2-dev.1"
  s.summary = "The Hop Apple client SDK (hps:// channels + relay pool): a mesh node over libhop ABI 6."
  s.homepage = "https://github.com/hopmesh/hop"
  s.license = {:type => "Apache-2.0", :file => "LICENSE.md"}
  s.authors = {"Hop Mesh, LLC" => "jason@waldrip.net"}
  # True provenance of the vendored Swift (ignored under :path, required by validation):
  # this commit of the monorepo is where Sources/ was copied from.
  s.source = {:git => "https://github.com/hopmesh/hop.git", :commit => "54a2e8207834d6b4f8e2ee6cfc4e27b7b403b56c"}
  s.platforms = {:ios => "16.0", :osx => "13.0"}
  s.source_files = "Sources/Hop/**/*.swift"
  s.swift_version = "5.9"
  s.frameworks = "Foundation"

  # Static on purpose: the Hop symbols this pod calls live in the static libhop.a that CHop
  # vendors, and a dynamic framework does not absorb a static dependency.
  s.static_framework = true

  s.dependency "CHop", "0.0.2-dev.1"
  s.dependency "HopContract", "0.0.2-dev.1"
end
