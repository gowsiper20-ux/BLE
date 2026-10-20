export const APPLICATION_TIME_ZONE = 'Asia/Kolkata';

export function getDateInTimeZone(date = new Date(), timeZone = APPLICATION_TIME_ZONE): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}

export function getWeekdayInTimeZone(date = new Date(), timeZone = APPLICATION_TIME_ZONE): string {
  return date.toLocaleDateString('en-US', { timeZone, weekday: 'long' }).toUpperCase();
}
