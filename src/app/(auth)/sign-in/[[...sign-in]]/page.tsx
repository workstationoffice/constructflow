import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">BuildFlow</h1>
          <p className="text-slate-500 mt-2">Field workforce & CRM platform</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-lg border border-slate-200",
            },
          }}
        />
      </div>
    </div>
  );
}
