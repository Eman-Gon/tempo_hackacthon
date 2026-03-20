"use client";

import { PrivyProvider as Provider } from "@privy-io/react-auth";

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <Provider
      appId={appId}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#16a34a",
          logo: undefined,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      {children}
    </Provider>
  );
}
