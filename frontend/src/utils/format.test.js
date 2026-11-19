import { describe, expect, it } from 'vitest'
import { APP_TIMEZONE, todayYmd } from './format'

describe('todayYmd', () => {
  it('defaults to the server timezone', () => {
    expect(APP_TIMEZONE).toBe('Asia/Kuala_Lumpur')
  })

  it("uses the app timezone, not the browser's", () => {
    // 20:00 UTC on 19 Nov is already 04:00 on 20 Nov in Kuala Lumpur (UTC+8)...
    const instant = new Date('2026-11-19T20:00:00Z')
    expect(todayYmd(instant)).toBe('2026-11-20')
    // ...while it is still 19 Nov in New York and 20 Nov in Auckland-ish zones.
    expect(todayYmd(instant, 'America/New_York')).toBe('2026-11-19')
    expect(todayYmd(instant, 'Pacific/Tongatapu')).toBe('2026-11-20')
  })

  it('formats as YYYY-MM-DD', () => {
    expect(todayYmd(new Date('2026-01-05T01:00:00Z'))).toBe('2026-01-05')
  })
})
