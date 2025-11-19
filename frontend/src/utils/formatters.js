/**
 * Date and time formatters for consistent display across the application.
 * Automatically converts UTC timestamps to user's local timezone.
 */

/**
 * Format an ISO date string to a readable, localized format.
 * Automatically converts UTC to the user's local timezone.
 * 
 * @param {string|null|undefined} isoString - ISO 8601 date string (e.g., "2025-11-19T06:49:00Z")
 * @param {object} options - Formatting options
 * @param {boolean} options.includeTime - Include time in output (default: true)
 * @param {boolean} options.includeDate - Include date in output (default: true)
 * @param {boolean} options.relative - Show relative time (e.g., "2 hours ago") (default: false)
 * @returns {string} Formatted date string or '—' if invalid
 */
export const formatDate = (isoString, options = {}) => {
  const {
    includeTime = true,
    includeDate = true,
    relative = false,
  } = options;

  if (!isoString) return '—';

  try {
    const date = new Date(isoString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '—';
    }

    // Show relative time if requested (e.g., "2 hours ago")
    if (relative) {
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
      
      // If older than a week, fall through to normal formatting
    }

    // Build format options based on what's requested
    const formatOptions = {};
    
    if (includeDate) {
      formatOptions.month = 'short';
      formatOptions.day = 'numeric';
      formatOptions.year = 'numeric';
    }
    
    if (includeTime) {
      formatOptions.hour = 'numeric';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = true;
    }

    // Format using browser's locale and timezone (automatically handles conversion)
    return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '—';
  }
};

/**
 * Format a date for display in a compact format (e.g., "Nov 19, 2025").
 * 
 * @param {string|null|undefined} isoString - ISO 8601 date string
 * @returns {string} Formatted date string
 */
export const formatDateCompact = (isoString) => {
  return formatDate(isoString, { includeTime: false, includeDate: true });
};

/**
 * Format a time for display (e.g., "2:49 PM").
 * 
 * @param {string|null|undefined} isoString - ISO 8601 date string
 * @returns {string} Formatted time string
 */
export const formatTime = (isoString) => {
  return formatDate(isoString, { includeTime: true, includeDate: false });
};

/**
 * Format a date with relative time fallback (e.g., "2 hours ago" or "Nov 19, 2025 2:49 PM").
 * 
 * @param {string|null|undefined} isoString - ISO 8601 date string
 * @returns {string} Formatted date string with relative time if recent
 */
export const formatDateRelative = (isoString) => {
  return formatDate(isoString, { includeTime: true, includeDate: true, relative: true });
};

/**
 * Format a date for use in input fields (YYYY-MM-DD).
 * 
 * @param {string|null|undefined} isoString - ISO 8601 date string
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatDateInput = (isoString) => {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
};

