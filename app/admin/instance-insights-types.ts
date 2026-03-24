export type SessionRow = {
  id: string;
  publicId: string;
  createdAt: string;
  choiceCount: number;
  ipAddress: string | null;
};

export type InstanceStats = {
  totalChoices: number;
  pins: {
    pinId: string;
    title: string;
    imageUrl: string | null;
    positive: number;
    negative: number;
    appearances: number;
    winRate: number | null;
  }[];
};
