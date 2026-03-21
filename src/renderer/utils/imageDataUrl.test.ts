import { describe, expect, it } from 'vitest';
import { parseDataUrlForAnthropic } from './imageDataUrl';

describe('parseDataUrlForAnthropic', () => {
    it('parses png and jpeg', () => {
        const png = parseDataUrlForAnthropic('data:image/png;base64,AAA');
        expect(png.media_type).toBe('image/png');
        expect(png.data).toBe('AAA');

        const jpg = parseDataUrlForAnthropic('data:image/jpg;base64,QkU=');
        expect(jpg.media_type).toBe('image/jpeg');
    });

    it('rejects invalid input', () => {
        expect(() => parseDataUrlForAnthropic('not-a-data-url')).toThrow('Invalid image data URL');
    });
});
