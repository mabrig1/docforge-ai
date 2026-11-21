import { formatDescriptionBlocks } from '@/lib/descriptionFormatting.mjs';

/**
 * Presents prose and song lyrics with meaningful spacing while preserving the
 * original text. Never inject HTML: the description is untrusted user content.
 */
function InlineText({ value }) {
  const parts = value.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={index} className="font-semibold text-gray-100">{part.slice(2, -2)}</strong>
    : part);
}

export default function ProductDescription({ description }) {
  const blocks = formatDescriptionBlocks(description);
  if (!blocks.length) return null;

  return (
    <section aria-label="Product description" className="min-w-0 max-w-full space-y-4 text-gray-300">
      {blocks.map((block, index) => {
        if (block.kind === 'divider') {
          return <hr key={index} className="border-gray-800 my-5" />;
        }
        if (block.kind === 'heading') {
          return (
            <h2 key={index} className="text-xl font-bold text-white leading-snug pt-3 first:pt-0 break-words">
              <InlineText value={block.text} />
            </h2>
          );
        }
        if (block.kind === 'subheading' || block.kind === 'verse') {
          return (
            <h3 key={index} className="text-base font-semibold text-brand-300 pt-2 break-words">
              <InlineText value={block.text} />
            </h3>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line break-words leading-8 text-sm sm:text-base">
            <InlineText value={block.text} />
          </p>
        );
      })}
    </section>
  );
}
