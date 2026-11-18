/**
 * Server-wide toggle to hide the custom widget (iframe UI) and fall back to
 * plain chat text + real (non-base64) image links for every host, ChatGPT
 * included.
 *
 * Added live after a report that ChatGPT showed everything twice — once in
 * the widget, once narrated in chat text (fixed separately by shrinking the
 * chat-text caption). This toggle is a stopgap for turning the widget off
 * entirely while its UX gets sorted out further, without losing images: set
 * WIDGET_ENABLED=false and every tool's chat text becomes a markdown listing
 * with real image links instead of the widget's iframe. Flip it back to
 * true (or unset it — true is the default) to restore the widget.
 */
export const WIDGET_ENABLED = process.env['WIDGET_ENABLED'] !== 'false';
