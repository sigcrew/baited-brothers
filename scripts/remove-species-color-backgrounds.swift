import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

enum BackgroundRemovalError: Error {
    case imageLoadFailed(String)
    case noForegroundFound(String)
    case imageWriteFailed(String)
}

let fileManager = FileManager.default
let projectRoot = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let speciesRoot = projectRoot
    .appendingPathComponent("assets/images/species/field60-illustrated")
let inputDirectory = speciesRoot.appendingPathComponent("color-background")
let outputDirectory = speciesRoot.appendingPathComponent("color")
let requestedFile = CommandLine.arguments.dropFirst().first

try fileManager.createDirectory(
    at: outputDirectory,
    withIntermediateDirectories: true
)

let files = try fileManager.contentsOfDirectory(
    at: inputDirectory,
    includingPropertiesForKeys: nil
)
    .filter { $0.pathExtension.lowercased() == "png" }
    .filter { requestedFile == nil || $0.lastPathComponent == requestedFile }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }

let context = CIContext(options: [.useSoftwareRenderer: false])
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

for inputURL in files {
    guard
        let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
        let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw BackgroundRemovalError.imageLoadFailed(inputURL.path)
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage)
    try handler.perform([request])

    guard let observation = request.results?.first else {
        throw BackgroundRemovalError.noForegroundFound(inputURL.path)
    }

    let maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances,
        from: handler
    )

    let sourceImage = CIImage(cgImage: cgImage)
    let maskImage = CIImage(cvPixelBuffer: maskBuffer)
    let transparentImage = CIImage(color: .clear).cropped(to: sourceImage.extent)
    let blend = CIFilter.blendWithMask()
    blend.inputImage = sourceImage
    blend.backgroundImage = transparentImage
    blend.maskImage = maskImage

    guard let outputImage = blend.outputImage else {
        throw BackgroundRemovalError.imageWriteFailed(inputURL.path)
    }

    let outputURL = outputDirectory.appendingPathComponent(inputURL.lastPathComponent)
    try context.writePNGRepresentation(
        of: outputImage,
        to: outputURL,
        format: .RGBA8,
        colorSpace: colorSpace
    )

    print("Converted \(inputURL.lastPathComponent)")
}
