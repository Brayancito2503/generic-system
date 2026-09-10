import { ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

export default function UserMenu({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  if (!isSidebarOpen) {
    return (
      <div className={"bg-muted/60 flex flex-col items-center py-4 justify-center animate-sidebar-closed"}>
        <UserSettingsMenu>
          <Button variant="ghost" size="icon">
            <Avatar className="w-8 h-8">
              <AvatarImage
                src="https://avatar.vercel.sh/aprendo.png"
                alt="@yovanylg"
              />
              <AvatarFallback>YL</AvatarFallback>
            </Avatar>
          </Button>
        </UserSettingsMenu>
      </div>
    );
  }

  return (
    <div className="bg-muted/60 flex items-center py-4 px-6 gap-2">
      <Avatar>
        <AvatarImage
          src="https://avatar.vercel.sh/aprendo.png"
          alt="@yovanylg"
        />
        <AvatarFallback>YL</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-semibold">Yovany Luis</span>
        <span className="text-sm">yovany.lg@gmail.com</span>
      </div>
      <UserSettingsMenu>
        <Button variant="secondary" size="icon" className="h-6 w-6 ml-auto">
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
      </UserSettingsMenu>
    </div>
  );
}

function UserSettingsMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Support</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
