import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchViaDefinition, getViaDefinitionUrl, getViaSupportedKeyboardsUrl } from '../via-definitions';

describe('via-definitions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds official VIA v3 definition URLs from unsigned vendorProductId values', () => {
    expect(getViaDefinitionUrl(0x1234ABCD)).toBe('https://usevia.app/definitions/v3/305441741.json');
    expect(getViaDefinitionUrl(-1)).toBe('https://usevia.app/definitions/v3/4294967295.json');
  });

  it('builds the official VIA definition index URL', () => {
    expect(getViaSupportedKeyboardsUrl()).toBe('https://usevia.app/definitions/supported_kbs.json');
  });

  it('returns parsed JSON when the definition exists', async () => {
    const definition = { name: 'Fetched VIA' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ vendorProductIds: { v3: [0x1234ABCD] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue(definition),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchViaDefinition(0x1234ABCD)).resolves.toEqual(definition);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://usevia.app/definitions/supported_kbs.json');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://usevia.app/definitions/v3/305441741.json');
  });

  it('returns null when the v3 definition is not listed in the index', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ vendorProductIds: { v3: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchViaDefinition(0x1234ABCD)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns null when the definition endpoint returns the VIA app HTML fallback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ vendorProductIds: { v3: [0x1234ABCD] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        json: vi.fn(),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchViaDefinition(0x1234ABCD)).resolves.toBeNull();
  });
});
