import { CreditCard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const plans = [
  {
    name: "Starter",
    price: "$19",
    features: ["100 websites/mo", "Single analysis", "CSV export"],
  },
  {
    name: "Pro",
    price: "$49",
    popular: true,
    features: ["1,000 websites/mo", "Bulk CSV", "AI analysis", "All exports"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: ["Unlimited", "Dedicated workers", "SSO", "Priority support"],
  },
];

export function Billing() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Subscription & payment — placeholder until Stripe integration
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-6 flex items-center gap-4">
          <CreditCard className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No active subscription</p>
            <p className="text-sm text-muted-foreground">
              You are on the free plan. Choose a plan below.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.popular ? "border-primary shadow-lg ring-1 ring-primary" : ""}
          >
            <CardHeader>
              {plan.popular && (
                <span className="text-xs font-medium text-primary">Most popular</span>
              )}
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                {plan.price !== "Custom" && <span>/mo</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={plan.popular ? "default" : "outline"}
                onClick={() => toast.info("Billing integration coming soon")}
              >
                {plan.price === "Custom" ? "Contact sales" : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
