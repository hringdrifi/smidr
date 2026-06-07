<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vitepress';

const route = useRoute();
const isOpen = ref(false);
const imageSrc = ref('');
const imageAlt = ref('');

function openImage(image: HTMLImageElement) {
  imageSrc.value = image.currentSrc || image.src;
  imageAlt.value = image.alt;
  isOpen.value = true;
}

function closeImage() {
  isOpen.value = false;
}

function handleClick(event: MouseEvent) {
  const target = event.target;

  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  if (!target.closest('.VPDoc')) {
    return;
  }

  event.preventDefault();
  openImage(target);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeImage();
  }
}

watch(isOpen, (open) => {
  document.documentElement.classList.toggle('docs-image-lightbox-open', open);
});

watch(
  () => route.path,
  () => {
    closeImage();
  },
);

onMounted(() => {
  nextTick(() => {
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClick);
  document.removeEventListener('keydown', handleKeydown);
  document.documentElement.classList.remove('docs-image-lightbox-open');
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="docs-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="画像プレビュー"
      @click.self="closeImage"
    >
      <button class="docs-image-lightbox__close" type="button" aria-label="閉じる" @click="closeImage">
        x
      </button>
      <figure class="docs-image-lightbox__figure">
        <img class="docs-image-lightbox__image" :src="imageSrc" :alt="imageAlt">
        <figcaption v-if="imageAlt" class="docs-image-lightbox__caption">
          {{ imageAlt }}
        </figcaption>
      </figure>
    </div>
  </Teleport>
</template>
