export const ProjectConfigTemplate = {
  "testRunName": "",
  "serverUrl": "http://localhost:8188",
  "triggerTokens": "",
  "baseResolution": 1024,
  "enableReferenceOutputs": true,
  "saveOutputsLocally": true,
  "loraStrengthValues": [
    1.0,
    0.75
  ],
  "_loraClipStrengthValues": [
    1.0
  ],
  "generationParams": {
    "ckpt_name": "",
    "sampler_name": "euler_ancestral",
    "scheduler": "sgm_uniform",
    "steps": 20,
    "cfg": 7,
    "seed": -1,
    "batch_size": 1
  },
  "testPrompts": [
    {
      "name": "init",
      "enabled": true,
      "positive": "${triggerTokens}",
      "negative": ""
    },
    {
      "name": "simple_portrait",
      "enabled": true,
      "positive": "${triggerTokens}, looking at viewer, arms crossed, happy, outdoors, portrait, simple background",
      "negative": ""
    },
    {
      "name": "angry_urban",
      "enabled": true,
      "positive": "${triggerTokens}, angry expression, leather jacket, tank top, urban alleyway, stormy weather, rain pouring, neon lights, close-up shot, dramatic lighting",
      "negative": ""
    },
    {
      "name": "bedroom_stretch",
      "enabled": true,
      "positive": "${triggerTokens}, stretching arms above head, relaxed expression, oversized sweater, shorts, sitting by open window, cozy bedroom, potted plants, messy desk, morning sunlight, medium shot, golden lighting", 
      "negative": ""
    },
    {
      "name": "snowscape",
      "enabled": true,
      "positive": "${triggerTokens}, standing in snow-covered forest, fur-lined coat, gloves, knee-high boots, snow falling, sunset glow, pine trees, wide-angle shot, serene atmosphere",
      "negative": ""
    },
    {
      "name": "kimono",
      "enabled": true,
      "positive": "${triggerTokens}, floral-patterned kimono, pastel colors, holding paper fan, soft smile, Japanese garden, cherry blossoms, koi pond, medium shot, sunlight filtering through trees, intricate shadows",
      "negative": ""
    },
    {
      "name": "rainy_mood",
      "enabled": true,
      "positive": "${triggerTokens}, standing in rain, soaked clothing, trench coat, shirt, pants, somber expression, urban street, wet pavement, blurred headlights, neon signs, medium shot, dramatic lighting",
      "negative": ""
    },
    {
      "name": "pastel",
      "enabled": true,
      "positive": "${triggerTokens}, sitting on park bench, holding umbrella, gentle rain, coat, scarf, watercolor style, soft pastel tones, trees, wet cobblestones, dreamy atmosphere",
      "negative": ""
    },
    {
      "name": "fantasy_ghibli",
      "enabled": true,
      "positive": "${triggerTokens}, holding a magical staff, casting spell, swirling magical energy, glowing runes, dark forest background, inspired by studio ghibli, vibrant colors, fantasy setting, highly detailed environment",
      "negative": ""
    },
    {
      "name": "manga_style",
      "enabled": true,
      "positive": "${triggerTokens}, relaxing by a window, reading book, warm sunlight streaming through, cozy interior, minimalistic aesthetic, inspired by inio asano, manga-style, intricate details in background",
      "negative": ""
    },
    {
      "name": "van_gogh",
      "enabled": true,
      "positive": "${triggerTokens}, playing guitar under a tree, serene expression, grassy hill, sunset background, inspired by vincent van gogh, post-impressionism, swirling brush strokes, vibrant contrasts",
      "negative": ""
    },

  ]
}
