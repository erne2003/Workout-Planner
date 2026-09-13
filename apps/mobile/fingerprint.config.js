// Forces the ios/ and android/ native directories to always be treated as
// generated (CNG) output rather than committed native code when computing the
// EAS "fingerprint" runtime version.
//
// Without this, @expo/fingerprint decides "managed" vs "generic" workflow by
// checking whether a native project marker (ios/*.xcodeproj/project.pbxproj,
// android/app/build.gradle) exists AND isn't git-ignored. EAS Build uploads
// don't include .git, so that git-ignore check can disagree with a local
// machine's check on the same gitignored, prebuild-generated directories,
// producing two different hashes for the same source and failing the build
// with a "Runtime version calculated on local machine not equal to runtime
// version calculated during build" error. Explicitly ignoring these paths
// here makes the workflow classification (and resulting hash) deterministic
// regardless of git availability or working directory.
module.exports = {
  ignorePaths: ['ios/**/*', 'android/**/*'],
};
