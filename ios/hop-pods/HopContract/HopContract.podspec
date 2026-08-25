# HopContract: the pure Swift bearer contract, vendored from hop main 54a2e82.
#
# Consumed with :path, so s.source is never read; the Swift beside this spec IS the source. See
# ios/hop-pods/README.md for why this replaced the v0.0.2 git-tag pin.

Pod::Spec.new do |s|
  s.name = "HopContract"
  s.version = "0.0.2-dev.1"
  s.summary = "The Hop bearer contract (pure Swift, no libhop)."
  s.homepage = "https://github.com/hopmesh/hop"
  s.license = {:type => "Apache-2.0", :file => "LICENSE.md"}
  s.authors = {"Hop Mesh, LLC" => "jason@waldrip.net"}
  # True provenance of the vendored Swift (ignored under :path, required by validation):
  # this commit of the monorepo is where Sources/ was copied from.
  s.source = {:git => "https://github.com/hopmesh/hop.git", :commit => "54a2e8207834d6b4f8e2ee6cfc4e27b7b403b56c"}
  s.platforms = {:ios => "16.0", :osx => "13.0"}
  s.source_files = "Sources/HopContract/**/*.swift"
  s.swift_version = "5.9"
end
