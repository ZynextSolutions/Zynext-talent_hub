import { toPng } from "html-to-image";

async function waitForImages(element: HTMLElement) {
  const images = [...element.querySelectorAll("img")];
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );
}

export async function downloadElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: element.style.backgroundColor || "#0b1020",
  });
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
