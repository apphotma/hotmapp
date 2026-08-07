const STATUS_PRIORITY = {
  pending: 0,
  sent: 1,
  notified: 2,
  delivered: 3,
  read: 4
};

export const getMessageStatusIcon = (status) => {
  if (status === 'pending') return 'fa-clock';
  if (status === 'notified') return 'fa-paper-plane';
  if (status === 'sent') return 'fa-check';
  return 'fa-check-double';
};

export const isMessagePending = (status) => status === 'pending';

export const mergeMessageStatus = (currentStatus, incomingStatus) => {
  if (!currentStatus || !incomingStatus) return currentStatus || incomingStatus || 'notified';
  const currentPriority = STATUS_PRIORITY[currentStatus] ?? STATUS_PRIORITY.sent;
  const incomingPriority = STATUS_PRIORITY[incomingStatus] ?? STATUS_PRIORITY.sent;
  return incomingPriority >= currentPriority ? incomingStatus : currentStatus;
};
