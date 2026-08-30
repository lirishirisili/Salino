import ExpoModulesCore
import FBAudienceNetwork

public class MetaAttBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MetaAttBridge")

    AsyncFunction("setAdvertiserTrackingEnabled") { (enabled: Bool) in
      FBAdSettings.setAdvertiserTrackingEnabled(enabled)
    }
  }
}
