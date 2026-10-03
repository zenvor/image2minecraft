// Keep the negative constraints in the text sent with the reference image.
export const MINECRAFT_TRANSFORM_PROMPT = `Convert the supplied image into a high-fidelity Minecraft world screenshot. Change geometry and materials into Minecraft blocks and pixel textures. Priority: source fidelity > recognizable Minecraft form > shader polish. Return only the transformed image.

PRESERVE THE SCENE
Match the original camera, perspective, framing, field of view, horizon, depth, and relative scale. Preserve every visible subject and object: count, position, silhouette, pose, orientation, distinctive details, clothing colors, and spatial relationships. Convert animals, vegetation, buildings, terrain, vehicles, and other scene elements into cubic Minecraft geometry with stepped contours and readable pixel textures.

PRESERVE WEATHER AND LIGHT
Use the source as ground truth for weather, cloud cover, time of day, season cues, visibility, and indoor or outdoor illumination. Match exposure, white balance, palette, saturation, contrast, light direction, shadow strength and softness, and atmospheric depth. Retain visible rain, snow, fog, haze, and wetness at their original intensity; leave ambiguous conditions ambiguous. Overcast stays overcast with matching clouds and diffuse skylight, without added sunshine, blue-sky openings, sunbeams, or golden-hour glow. Sunny scenes retain their sunlight and shadows; night and indoor scenes retain their brightness and existing light sources.

SHADER QUALITY
Render like a high-end Minecraft shader modpack under the source's actual conditions. Use coherent, physically plausible shading; high quality does not mean sunny or more colorful. Volumetric light requires visible light shafts in the source. Reflections require existing water or reflective surfaces and must match their roughness, surface state, and surroundings. Preserve muted or vibrant colors as shown.

NEGATIVE CONSTRAINTS
Do not change weather, time, season, lighting, composition, or subjects. Do not invent sun, god rays, flare, blue sky, precipitation, fog, wetness, puddles, water, objects, mobs, or fantasy scenery. No missing or duplicated objects, altered poses, camera shifts, cropping, zooming, oversaturation, excessive bloom or HDR, crushed shadows, artificial brightening, smooth or rounded scene geometry, flat 2D pixel art, or added text, logos, watermarks, borders, HUD, or UI. These restrictions prohibit unsupported additions or changes; preserve features already present in the source.`;
