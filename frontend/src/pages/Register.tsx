import { Link, useNavigate } from "react-router-dom";
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

const schema = z
  .object({
    full_name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/register", {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });
      setAuth(res.data.user, res.data.access_token);
      toast.success("Account created!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Registration failed"));
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
            <CardTitle className="text-2xl">Create account</CardTitle>
            <CardDescription>Start automating website research today</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                id="full_name"
                label="Full name"
                placeholder="John Doe"
                error={errors.full_name?.message}
                {...register("full_name")}
              />
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
                error={errors.password?.message}
                {...register("password")}
              />
              <Input
                id="confirm_password"
                label="Confirm password"
                type="password"
                error={errors.confirm_password?.message}
                {...register("confirm_password")}
              />
              <Button type="submit" className="w-full" loading={isSubmitting}>
                Create account
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
