import { buildCustomerSidebarUsers, countPendingRequestBreakdown, countPendingRequests, shouldShowUserInNewCustomersTab, shouldShowUserInRequestsModal } from '../public/friend-list-utils.js';

describe('friend request visibility helpers', () => {
  it('does not include pending outgoing requests in the customer sidebar', () => {
    const customerUsers = buildCustomerSidebarUsers({
      moduleFriendsList: { userA: true },
      allUsersCache: { userA: { fullname: 'Alice' }, userB: { fullname: 'Bob' } },
      currentChatListIds: {},
      isChatLocked: () => false
    });

    expect(customerUsers).toEqual({
      userA: { fullname: 'Alice' }
    });
  });

  it('keeps pending requests visible only in the requests modal', () => {
    expect(shouldShowUserInRequestsModal({ hasIncomingRequest: false, hasSentRequest: true })).toBe(true);
    expect(shouldShowUserInNewCustomersTab({ isCustomer: false, hasIncomingRequest: false, hasSentRequest: true })).toBe(false);
    expect(shouldShowUserInNewCustomersTab({ isCustomer: false, hasIncomingRequest: true, hasSentRequest: false })).toBe(false);
    expect(shouldShowUserInNewCustomersTab({ isCustomer: false, hasIncomingRequest: false, hasSentRequest: false })).toBe(true);
  });

  it('counts both incoming and outgoing pending requests for the notification badge', () => {
    expect(countPendingRequests({
      incomingRequests: { userA: true, userB: false },
      outgoingRequests: { userC: true }
    })).toBe(2);
    expect(countPendingRequestBreakdown({
      incomingRequests: { userA: true, userB: false },
      outgoingRequests: { userC: true }
    })).toEqual({ incomingCount: 1, outgoingCount: 1 });
  });
});
