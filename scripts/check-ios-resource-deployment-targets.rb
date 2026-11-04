# Run after `cd ios && pod install`, using the Ruby that provides CocoaPods.
require 'json'
require 'xcodeproj'

root = File.expand_path('..', __dir__)
properties = JSON.parse(File.read(File.join(root, 'ios/Podfile.properties.json')))
minimum = Gem::Version.new(properties.fetch('ios.deploymentTarget', '15.1'))
project = Xcodeproj::Project.open(File.join(root, 'ios/Pods/Pods.xcodeproj'))
bundles = project.native_targets.select do |target|
  target.platform_name == :ios && target.product_type == 'com.apple.product-type.bundle'
end
abort 'No iOS resource bundles found; run pod install first.' if bundles.empty?

errors = []
bundles.each do |target|
  target.build_configurations.each do |config|
    value = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_s
    unless value.match?(/\A\d+(?:\.\d+)*\z/) && Gem::Version.new(value) >= minimum
      errors << "#{target.name} #{config.name}: #{value.inspect} is below or cannot be compared to #{minimum}"
    end
  end
end

app = Xcodeproj::Project.open(File.join(root, 'ios/app.xcodeproj')).native_targets.find { |t| t.name == 'app' }
abort 'App target not found.' unless app
app.build_configurations.each do |config|
  value = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
  errors << "app #{config.name}: #{value.inspect} differs from #{minimum}" unless value == minimum.to_s
end
abort errors.join("\n") unless errors.empty?
puts "PASS: #{bundles.length} iOS resource bundles meet #{minimum}; app minimum remains #{minimum}."
