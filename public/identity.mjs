// Retain the channel key in stored settings and templates for compatibility.
export const CHANNEL_MAX_LENGTH = 80;
export const validChannel = value => typeof value === 'string' && value.length <= CHANNEL_MAX_LENGTH && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value);
const displayName = value => typeof value === 'string' ? value.trim() : '';
export const channelText = value => displayName(value) || 'this channel';
export const channelLabel = value => displayName(value).toUpperCase() || 'LIVE';
