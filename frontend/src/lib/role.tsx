import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "admin" | "user";

type RoleContextValue = {
  role: Role;
  setRole: (role: Role) => void;
  isAdmin: boolean;
};

const RoleContext = createContext<RoleContextValue>({
  role: "admin",
  setRole: () => {},
  isAdmin: true,
});

/** Mock, frontend-only role switching. No real authentication involved. */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("admin");
  return (
    <RoleContext.Provider value={{ role, setRole, isAdmin: role === "admin" }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
