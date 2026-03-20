CREATE POLICY "Expense payer can delete splits"
ON public.expense_splits
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_splits.expense_id
    AND e.paid_by = auth.uid()
  )
);