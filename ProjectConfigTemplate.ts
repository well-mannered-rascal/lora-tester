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
    }
  ]
}