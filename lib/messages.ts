/**
 * Centralized confirmation and feedback messages for the application.
 */

export const getDeleteConfirmationMessage = (itemType: string, identifier?: string) => {
  if (identifier) {
    return `Are you sure you want to permanently delete ${itemType} "${identifier}"?`;
  }
  return `Are you sure you want to permanently delete this ${itemType}?`;
};
