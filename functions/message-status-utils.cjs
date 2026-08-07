const shouldAdvanceToDelivered = (status) => {
  const normalizedStatus = status || 'sent';
  return normalizedStatus === 'pending' || normalizedStatus === 'sent';
};

module.exports = {
  shouldAdvanceToDelivered
};
