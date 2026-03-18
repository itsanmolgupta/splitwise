import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, HandCoins } from "lucide-react";
import { motion } from "framer-motion";
import CreateGroupDialog from "./CreateGroupDialog";
import AddExpenseDialog from "./AddExpenseDialog";
import SettleUpDialog from "./SettleUpDialog";

const QuickActions = () => {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [settleUpOpen, setSettleUpOpen] = useState(false);

  const actions = [
    { label: "Add Expense", icon: Plus, variant: "default" as const, onClick: () => setAddExpenseOpen(true) },
    { label: "Create Group", icon: Users, variant: "outline" as const, onClick: () => setCreateGroupOpen(true) },
    { label: "Settle Up", icon: HandCoins, variant: "outline" as const, onClick: () => setSettleUpOpen(true) },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardContent className="flex flex-wrap gap-3 p-4">
            {actions.map((action) => (
              <Button key={action.label} variant={action.variant} className="gap-2" onClick={action.onClick}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
      <AddExpenseDialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen} />
      <SettleUpDialog open={settleUpOpen} onOpenChange={setSettleUpOpen} />
    </>
  );
};

export default QuickActions;
