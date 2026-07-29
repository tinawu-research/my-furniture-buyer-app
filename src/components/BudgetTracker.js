export default function BudgetTracker({ budget, spent, pending = 0 }) {
  const remaining = budget - spent - pending;
  const usedFraction = budget > 0 ? Math.min(1, (spent + pending) / budget) : 0;
  const overBudget = remaining < 0;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-500">Budget</span>
        <span className={overBudget ? "text-red-600 font-medium" : "font-medium"}>
          ${remaining.toFixed(2)} remaining of ${budget.toFixed(2)}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
        <div
          className={`h-full ${overBudget ? "bg-red-500" : "bg-black"}`}
          style={{ width: `${usedFraction * 100}%` }}
        />
      </div>
    </div>
  );
}
