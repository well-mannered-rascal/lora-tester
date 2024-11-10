export const DefaultWorkflow = {
  "3": {
    "inputs": {
      "seed": "${seed}",
      "steps": "${steps}",
      "cfg": "${cfg}",
      "sampler_name": "${sampler_name}",
      "scheduler": "${scheduler}",
      "denoise": 1,
      "model": [
        "10",
        0
      ],
      "positive": [
        "6",
        0
      ],
      "negative": [
        "7",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "4": {
    "inputs": {
      "ckpt_name": "${ckpt_name}"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "5": {
    "inputs": {
      "width": "${width}",
      "height": "${height}",
      "batch_size": "${batch_size}"
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "Empty Latent Image"
    }
  },
  "6": {
    "inputs": {
      "text": "${positive}",
      "clip": [
        "10",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },

  "7": {
    "inputs": {
      "text": "${negative}",
      "clip": [
        "10",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Negative Prompt)"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "3",
        0
      ],
      "vae": [
        "4",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "${filenamePrefix}",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "Save Image"
    }
  },
  "10": {
    "inputs": {
      "lora_name": "${loraModel}",
      "strength_model": "${loraStrength}",
      "strength_clip": "${loraClipStrength}",
      "model": [
        "4",
        0
      ],
      "clip": [
        "4",
        1
      ]
    },
    "class_type": "LoraLoader",
    "_meta": {
      "title": "Load LoRA"
    }
  }
}
