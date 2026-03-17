import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, HandCoins } from "lucide-react";
import { motion } from "framer-motion";

const QuickActions = () => {
  const actions = [
    {
      label: "Add Expense",
      icon: Plus,
      variant: "default" as const,
    },
    {
      label: "Create Group",
      icon: Users,
      variant: "outline" as const,
    },
    {
      label: "Settle Up",
      icon: HandCoins,
      variant: "outline" as const,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant} className="gap-2">
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default QuickActions;
