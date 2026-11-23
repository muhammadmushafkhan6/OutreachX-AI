import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { api, getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { Logo } from "@/components/layout/Logo";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/login", data);
      setAuth(res.data.user, res.data.access_token);
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Login failed"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 hero-glow">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Link to="/" className="inline-flex items-center justify-center mb-4">
              <Logo className="w-auto h-auto" />
            </Link>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your OutreachX AI account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                id="email"
                label="Email"
                type="email"
                placeholder="you@agency.com"
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register("password")}
              />
              <Button type="submit" className="w-full" loading={isSubmitting}>
                Sign in
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Register
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
