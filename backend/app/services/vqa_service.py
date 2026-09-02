from functools import lru_cache

from PIL import Image


@lru_cache(maxsize=1)
def _load_model():
    from transformers import BlipForQuestionAnswering, BlipProcessor

    processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
    model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base")
    return processor, model


def answer_question(image_path, question: str) -> str:
    processor, model = _load_model()
    image = Image.open(image_path).convert("RGB")
    inputs = processor(image, question, return_tensors="pt")
    output = model.generate(**inputs, max_new_tokens=20)
    return processor.decode(output[0], skip_special_tokens=True)
