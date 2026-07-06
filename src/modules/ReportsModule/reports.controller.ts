import { Request, Response } from "express";
import User from "../UserModule/models/User";
import Meeting from "../MeetingModule/MeetingModels/Meeting";
import Customer from "../CustomerModule/customer.model";
import Order from "../OrderModule/order.model";
import EcomPayment from "../EcomPaymentModule/Ecompayment.model";
import MailLog from "../MailModule/MailModel";
import PlanModel from "../PlanModule/models/Plan";
import UserSubscription from "../PaymentModule/models/Subscription";

type ReportRange = {
  startDate: Date;
  endDate: Date;
};

const toDateRange = (query: Request["query"]): ReportRange => {
  const endDate = query.endDate ? new Date(String(query.endDate)) : new Date();
  const startDate = query.startDate
    ? new Date(String(query.startDate))
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid startDate or endDate");
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

type CreditSnapshot = {
  yoga: number;
  zumba: number;
  specialty: number;
  total: number;
};

const sumCredits = (credits?: Partial<CreditSnapshot> | null): CreditSnapshot => {
  const yoga = Number(credits?.yoga || 0);
  const zumba = Number(credits?.zumba || 0);
  const specialty = Number(credits?.specialty || 0);
  return {
    yoga,
    zumba,
    specialty,
    total: yoga + zumba + specialty,
  };
};

const resolvePurchasedCredits = (user: any): CreditSnapshot => {
  const current = sumCredits(user?.classCredits);
  const overall = sumCredits(user?.overAllclassCredits);
  const totalClassCredits = Number(user?.totalClassCredits || 0);
  const total = Math.max(current.total, overall.total, totalClassCredits);

  return {
    yoga: Math.max(current.yoga, overall.yoga),
    zumba: Math.max(current.zumba, overall.zumba),
    specialty: Math.max(current.specialty, overall.specialty),
    total,
  };
};

const resolveUsedCredits = (user: any): CreditSnapshot => {
  const current = sumCredits(user?.classCredits);
  const purchased = resolvePurchasedCredits(user);

  return {
    yoga: Math.max(0, purchased.yoga - current.yoga),
    zumba: Math.max(0, purchased.zumba - current.zumba),
    specialty: Math.max(0, purchased.specialty - current.specialty),
    total: Math.max(0, purchased.total - current.total),
  };
};

const formatCreditRow = (user: any) => {
  const purchased = resolvePurchasedCredits(user);
  const used = resolveUsedCredits(user);
  const current = sumCredits(user?.classCredits);

  return {
    userId: String(user?._id || ""),
    firstName: String(user?.firstName || ""),
    lastName: String(user?.lastName || ""),
    email: String(user?.email || ""),
    plan: String(user?.plan || ""),
    subscriptionStatus: String(user?.subscription?.status || "inactive"),
    billingType: String(user?.billingType || "monthly"),
    pendingPlan: String(user?.pendingPlan || ""),
    pendingBillingType: String(user?.pendingBillingType || ""),
    pendingEffectiveDate: user?.pendingEffectiveDate || null,
    purchasedCredits: purchased,
    usedCredits: used,
    remainingCredits: current,
    createdAt: user?.createdAt || null,
  };
};

export class ReportsController {
  getOverview = async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = toDateRange(req.query);

      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalCustomers,
        totalMeetings,
        upcomingMeetings,
        completedMeetings,
        totalOrders,
        paidOrders,
        totalPayments,
        emailLogs,
        activePlans,
        subscriptions,
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        Customer.countDocuments({}),
        Meeting.countDocuments({}),
        Meeting.countDocuments({ localTime: { $gte: new Date() } }),
        Meeting.countDocuments({ status: "completed" }),
        Order.countDocuments({}),
        Order.countDocuments({ orderStatus: { $in: ["Delivered", "Completed"] } }),
        EcomPayment.aggregate([
          { $match: { status: "succeeded", createdAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        MailLog.countDocuments({ sentAt: { $gte: startDate, $lte: endDate } }),
        PlanModel.countDocuments({ isActive: true }),
        UserSubscription.find({}).lean(),
      ]);

      const subscriptionCounts = subscriptions.reduce(
        (acc, subscription) => {
          const status = String(subscription.status || "ACTIVE").toUpperCase();
          if (status in acc) {
            acc[status as keyof typeof acc] += 1;
          }
          return acc;
        },
        { ACTIVE: 0, EXPIRED: 0, CANCELLED: 0 },
      );

      const monthlyRevenueAgg = await EcomPayment.aggregate([
        {
          $match: {
            status: "succeeded",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      const monthlyRevenue = monthlyRevenueAgg.map((item) => {
        const date = new Date(item._id.year, item._id.month - 1, 1);
        return {
          month: getMonthKey(date),
          label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          total: Number(item.total || 0),
          count: Number(item.count || 0),
        };
      });

      const report = {
        generatedAt: new Date().toISOString(),
        range: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: inactiveUsers,
          },
          customers: {
            total: totalCustomers,
          },
          meetings: {
            total: totalMeetings,
            upcoming: upcomingMeetings,
            completed: completedMeetings,
          },
          orders: {
            total: totalOrders,
            paid: paidOrders,
          },
          finance: {
            totalRevenue: Number(totalPayments[0]?.total || 0),
          },
          emails: {
            sent: emailLogs,
          },
          plans: {
            active: activePlans,
            subscriptions: subscriptionCounts,
          },
        },
        monthlyRevenue,
      };

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error("[ReportsController] getOverview failed:", error?.message || error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to generate report",
      });
    }
  };

  exportCsv = async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = toDateRange(req.query);

      const [userCount, customerCount, meetingCount, orderCount, paymentAgg, mailCount] =
        await Promise.all([
          User.countDocuments({}),
          Customer.countDocuments({}),
          Meeting.countDocuments({ localTime: { $gte: startDate, $lte: endDate } }),
          Order.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
          EcomPayment.aggregate([
            { $match: { status: "succeeded", createdAt: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]),
          MailLog.countDocuments({ sentAt: { $gte: startDate, $lte: endDate } }),
        ]);

      const rows = [
        ["metric", "value"],
        ["users_total", String(userCount)],
        ["customers_total", String(customerCount)],
        ["meetings_in_range", String(meetingCount)],
        ["orders_in_range", String(orderCount)],
        ["payments_total", String(Number(paymentAgg[0]?.total || 0))],
        ["emails_sent", String(mailCount)],
      ];

      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=report-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}.csv`,
      );
      return res.status(200).send(csv);
    } catch (error: any) {
      console.error("[ReportsController] exportCsv failed:", error?.message || error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to export report",
      });
    }
  };

  getCreditReport = async (req: Request, res: Response) => {
    try {
      const page = Math.max(parseInt(String(req.query.page || "1"), 10), 1);
      const limit = Math.max(parseInt(String(req.query.limit || "10"), 10), 1);
      const search = String(req.query.search || "").trim();
      const status = String(req.query.status || "all").trim().toLowerCase();
      const skip = (page - 1) * limit;

      const query: any = {};

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { plan: { $regex: search, $options: "i" } },
          { pendingPlan: { $regex: search, $options: "i" } },
        ];
      }

      if (status !== "all") {
        query["subscription.status"] = status;
      }

      const [users, totalCount, subscriptionCounts, allUsers] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query),
        User.aggregate([
          {
            $group: {
              _id: { $ifNull: ["$subscription.status", "inactive"] },
              count: { $sum: 1 },
            },
          },
        ]),
        User.find({}).select("classCredits overAllclassCredits totalClassCredits").lean(),
      ]);

      const allPurchasedTotal = allUsers.reduce(
        (sum, user) => sum + resolvePurchasedCredits(user).total,
        0,
      );
      const allRemainingTotal = allUsers.reduce(
        (sum, user) => sum + sumCredits(user?.classCredits).total,
        0,
      );
      const allUsedTotal = Math.max(0, allPurchasedTotal - allRemainingTotal);

      const summary = {
        totalUsers: await User.countDocuments({}),
        activeUsers: await User.countDocuments({ isActive: true }),
        pendingPlans: await User.countDocuments({
          $and: [
            { pendingPlan: { $ne: null } },
            { pendingPlan: { $ne: "" } },
          ],
        }),
        totalPurchasedCredits: allPurchasedTotal,
        totalUsedCredits: allUsedTotal,
        totalRemainingCredits: allRemainingTotal,
        subscriptionCounts: subscriptionCounts.reduce(
          (acc, entry) => {
            const key = String(entry._id || "inactive").toLowerCase();
            if (key === "active" || key === "inactive" || key === "suspended" || key === "cancelled" || key === "expired") {
              acc[key] = Number(entry.count || 0);
            }
            return acc;
          },
          {
            active: 0,
            inactive: 0,
            suspended: 0,
            cancelled: 0,
            expired: 0,
          },
        ),
      };

      return res.status(200).json({
        success: true,
        data: {
          summary,
          items: users.map(formatCreditRow),
          pagination: {
            currentPage: page,
            totalPages: Math.max(1, Math.ceil(totalCount / limit)),
            totalCount,
            limit,
            hasNextPage: page < Math.max(1, Math.ceil(totalCount / limit)),
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error: any) {
      console.error("[ReportsController] getCreditReport failed:", error?.message || error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to generate credit report",
      });
    }
  };

  exportCreditCsv = async (req: Request, res: Response) => {
    try {
      const search = String(req.query.search || "").trim();
      const status = String(req.query.status || "all").trim().toLowerCase();
      const query: any = {};

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { plan: { $regex: search, $options: "i" } },
          { pendingPlan: { $regex: search, $options: "i" } },
        ];
      }

      if (status !== "all") {
        query["subscription.status"] = status;
      }

      const users = await User.find(query).sort({ createdAt: -1 }).lean();
      const rows = [
        [
          "name",
          "email",
          "plan",
          "subscription_status",
          "purchased_total",
          "used_total",
          "remaining_total",
          "pending_plan",
          "pending_billing_type",
          "pending_effective_date",
        ],
        ...users.map((user) => {
          const purchased = resolvePurchasedCredits(user);
          const used = resolveUsedCredits(user);
          const remaining = sumCredits(user?.classCredits);
          return [
            `${String(user?.firstName || "")} ${String(user?.lastName || "")}`.trim(),
            String(user?.email || ""),
            String(user?.plan || ""),
            String(user?.subscription?.status || "inactive"),
            String(purchased.total),
            String(used.total),
            String(remaining.total),
            String(user?.pendingPlan || ""),
            String(user?.pendingBillingType || ""),
            user?.pendingEffectiveDate ? new Date(user.pendingEffectiveDate).toISOString() : "",
          ];
        }),
      ];

      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=credit-report.csv`);
      return res.status(200).send(csv);
    } catch (error: any) {
      console.error("[ReportsController] exportCreditCsv failed:", error?.message || error);
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to export credit report",
      });
    }
  };
}