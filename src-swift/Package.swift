// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "wifi-scanner",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "wifi-scanner",
            path: "Sources/wifi-scanner",
            linkerSettings: [
                .linkedFramework("CoreWLAN"),
                .linkedFramework("CoreLocation"),
                .linkedFramework("Foundation")
            ]
        )
    ]
)
