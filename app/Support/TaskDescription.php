<?php

namespace App\Support;

use Dom\Element;
use Dom\HTMLDocument;
use Dom\Node;
use Dom\Text;

final class TaskDescription
{
    private const FORMATTING = ['b', 'strong', 'i', 'em', 'br', 'p', 'div', 'ul', 'ol', 'li', 'blockquote'];

    public static function sanitize(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        $document = HTMLDocument::createFromString($html, LIBXML_NOERROR, 'UTF-8');
        $body = $document->getElementsByTagName('body')->item(0);
        $sanitized = self::children($body);

        return trim(html_entity_decode(strip_tags($sanitized), ENT_QUOTES | ENT_HTML5, 'UTF-8')) === ''
            ? null
            : $sanitized;
    }

    private static function children(Node $node): string
    {
        $html = '';
        foreach ($node->childNodes as $child) {
            if ($child instanceof Text) {
                $html .= htmlspecialchars($child->data, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');

                continue;
            }

            if (! $child instanceof Element || in_array($child->localName, ['script', 'style', 'textarea', 'template'], true)) {
                continue;
            }

            $tag = $child->localName;
            $content = self::children($child);
            $html .= match (true) {
                $tag === 'br' => '<br>',
                in_array($tag, self::FORMATTING, true) => "<{$tag}>{$content}</{$tag}>",
                default => $content,
            };
        }

        return $html;
    }
}
