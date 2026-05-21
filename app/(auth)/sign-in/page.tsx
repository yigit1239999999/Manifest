import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — PetTrack",
};

export default function SignInPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your clinic workspace.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignInForm />
        <p className="text-center text-sm text-muted-foreground">
          New to PetTrack?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary hover:underline"
          >
            Create a clinic account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
