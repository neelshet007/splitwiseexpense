export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  telegramChatId: string | null;
  telegramUsername: string | null;
  telegramConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberItem {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: string;
  user: SafeUser;
}

export interface GroupItem {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: GroupMemberItem[];
  _count?: {
    expenses: number;
    members: number;
  };
}

export interface GroupPreviewResponse {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  creatorName: string;
  isMember: boolean;
}

export interface JoinGroupResponse {
  group: GroupItem;
  alreadyMember: boolean;
  message: string;
}

export interface FriendItem {
  id: string;
  friendId: string;
  friend: SafeUser;
  netBalance: number; // In minor units: positive = they owe you, negative = you owe them
  totalPaid: number;
  totalShare: number;
  status: string;
}

export interface ExpenseSplitItem {
  id: string;
  expenseId: string;
  userId: string;
  amountOwed: number; // In minor units (paise/cents)
  user?: SafeUser;
}

export interface ExpenseItem {
  id: string;
  groupId: string | null;
  description: string;
  totalAmount: number; // In minor units (paise/cents)
  splitType: SplitType;
  paidBy: string;
  createdBy: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
  payer: SafeUser;
  creator: SafeUser;
  splits: ExpenseSplitItem[];
}

export interface CreateExpenseSplitInput {
  userId: string;
  amountOwed?: number; // In minor units
  percentage?: number; // E.g. 50 for 50%
}

export interface CreateExpensePayload {
  groupId?: string | null;
  description: string;
  totalAmount: number; // In minor units
  splitType: SplitType;
  paidBy: string;
  expenseDate?: string;
  splits: CreateExpenseSplitInput[];
}

export interface UserBalance {
  userId: string;
  userName: string;
  email: string;
  totalPaid: number; // Minor units
  totalShare: number; // Minor units
  netBalance: number; // Minor units (positive = owed money, negative = owes money)
}

export interface SettlementTransfer {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number; // Minor units
}

export interface GroupBalancesResponse {
  groupId: string;
  totalExpenses: number;
  balances: UserBalance[];
}

export interface GroupSettlementsResponse {
  groupId: string;
  settlements: SettlementTransfer[];
}

export interface DashboardSummary {
  user: SafeUser;
  totalPaid: number;
  totalShare: number;
  totalOwedToYou: number;
  totalYouOwe: number;
  netBalance: number;
  recentExpenses: ExpenseItem[];
  groups: GroupItem[];
  friends: FriendItem[];
}

export interface TelegramStatusResponse {
  connected: boolean;
  telegramUsername: string | null;
  botUsername?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
