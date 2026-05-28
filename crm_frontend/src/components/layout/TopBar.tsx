import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Command, Building2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/shared/Button";
import { NotificationBell } from "@/components/NotificationBell";
import { CRM_PATHS } from "@/navigation/crmPaths";
import { globalSearch, type GlobalSearchResults } from "@/services/search";
interface TopBarProps {
  onOpenCommandPalette?: () => void;
  onQuickCreateLead?: () => void;
  onQuickCreateAccount?: () => void;
}

export function TopBar({
  onOpenCommandPalette,
  onQuickCreateLead,
  onQuickCreateAccount,
}: TopBarProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenCommandPalette?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenCommandPalette]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void globalSearch(q, "own", 8)
        .then((data) => {
          setResults(data);
          setDropdownOpen(true);
        })
        .catch(() => setResults({ leads: [], accounts: [], guests: [] }))
        .finally(() => setIsSearching(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const goToLeadsWithQuery = useCallback(
    (q: string) => {
      navigate(`${CRM_PATHS.leads}?q=${encodeURIComponent(q)}`);
      setDropdownOpen(false);
    },
    [navigate]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;

    if (results) {
      if (results.leads[0]) {
        navigate(CRM_PATHS.leadDetail(results.leads[0].id));
        setDropdownOpen(false);
        return;
      }
      if (results.accounts[0]) {
        navigate(CRM_PATHS.accounts, { state: { accountId: results.accounts[0].id } });
        setDropdownOpen(false);
        return;
      }
    }

    goToLeadsWithQuery(q);
  };

  const hasResults =
    results &&
    (results.leads.length > 0 || results.accounts.length > 0 || results.guests.length > 0);

  const showDropdown = dropdownOpen && search.trim().length >= 2;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur-sm">
      <div ref={containerRef} className="relative flex-1 max-w-md">
        <form onSubmit={handleSearchSubmit}>
          <Search
            className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-faint"
            strokeWidth={1.5}
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.trim().length >= 2) setDropdownOpen(true);
            }}
            onFocus={() => {
              if (search.trim().length >= 2) setDropdownOpen(true);
            }}
            placeholder="Search leads, accounts, guests, hotels, PMS ID…"
            className="h-9 border-border bg-bg pl-9 pr-20 text-sm"
            aria-label="Global search"
            autoComplete="off"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] text-text-faint sm:inline">
            ⌘K
          </kbd>
        </form>

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(24rem,70vh)] overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
            {isSearching && (
              <p className="px-3 py-2 text-sm text-text-muted">Searching…</p>
            )}
            {!isSearching && !hasResults && (
              <p className="px-3 py-2 text-sm text-text-muted">No results</p>
            )}
            {!isSearching && results && results.leads.length > 0 && (
              <div className="py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  Leads
                </p>
                {results.leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-hover"
                    onClick={() => {
                      navigate(CRM_PATHS.leadDetail(lead.id));
                      setDropdownOpen(false);
                    }}
                  >
                    <span className="font-medium text-text">
                      {lead.guestName || lead.leadNumber}
                    </span>
                    <span className="text-xs text-text-muted">
                      {[lead.leadNumber, lead.hotelNames[0], lead.pmsReservationId, lead.bookingSource]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!isSearching && results && results.accounts.length > 0 && (
              <div className="border-t border-border py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  Accounts
                </p>
                {results.accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-hover"
                    onClick={() => {
                      navigate(CRM_PATHS.accounts, { state: { accountId: acc.id } });
                      setDropdownOpen(false);
                    }}
                  >
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <div>
                      <span className="font-medium text-text">{acc.name}</span>
                      <span className="block text-xs text-text-muted">
                        {[acc.city, acc.isChild && acc.parentName ? `Subsidiary of ${acc.parentName}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!isSearching && results && results.guests.length > 0 && (
              <div className="border-t border-border py-1">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  Guests
                </p>
                {results.guests.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-hover"
                    onClick={() => goToLeadsWithQuery(guest.name || guest.phone || "")}
                  >
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <div>
                      <span className="font-medium text-text">{guest.name}</span>
                      {(guest.phone || guest.email) && (
                        <span className="block text-xs text-text-muted">
                          {[guest.phone, guest.email].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onOpenCommandPalette && (
          <Button
            variant="ghost"
            size="sm"
            icon={Command}
            onClick={onOpenCommandPalette}
            aria-label="Command palette"
          />
        )}
        {onQuickCreateLead && (
          <Button variant="primary" size="sm" icon={Plus} onClick={onQuickCreateLead}>
            New lead
          </Button>
        )}
        {onQuickCreateAccount && (
          <Button variant="primary" size="sm" icon={Plus} onClick={onQuickCreateAccount}>
            New account
          </Button>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}
