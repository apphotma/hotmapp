export const buildCustomerSidebarUsers = ({
    moduleFriendsList = {},
    allUsersCache = {},
    currentChatListIds = {},
    isChatLocked = () => false
} = {}) => {
    const customerUsers = {};

    Object.keys(moduleFriendsList || {}).forEach((id) => {
        if (isChatLocked(id)) return;
        if (!allUsersCache[id]) return;

        const chatMeta = currentChatListIds[id] || {};
        const metadata = typeof chatMeta === 'object' ? chatMeta : { lastInteraction: chatMeta };
        customerUsers[id] = { ...allUsersCache[id], ...metadata };
    });

    return customerUsers;
};

export const shouldShowUserInRequestsModal = ({ hasIncomingRequest = false, hasSentRequest = false } = {}) => {
    return hasIncomingRequest || hasSentRequest;
};

export const shouldShowUserInNewCustomersTab = ({ isCustomer = false, hasIncomingRequest = false, hasSentRequest = false } = {}) => {
    return !isCustomer && !hasIncomingRequest && !hasSentRequest;
};

export const countPendingRequests = ({ incomingRequests = {}, outgoingRequests = {} } = {}) => {
    const incomingCount = Object.keys(incomingRequests || {}).filter((uid) => !!incomingRequests[uid]).length;
    const outgoingCount = Object.keys(outgoingRequests || {}).filter((uid) => !!outgoingRequests[uid]).length;
    return incomingCount + outgoingCount;
};

export const countPendingRequestBreakdown = ({ incomingRequests = {}, outgoingRequests = {} } = {}) => {
    const incomingCount = Object.keys(incomingRequests || {}).filter((uid) => !!incomingRequests[uid]).length;
    const outgoingCount = Object.keys(outgoingRequests || {}).filter((uid) => !!outgoingRequests[uid]).length;
    return { incomingCount, outgoingCount };
};
