import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Pagination,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import { api, getApiErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import MentorAvailabilityModal from "../components/mentors/MentorAvailabilityModal";
import MentorCard from "../components/mentors/MentorCard";
import MentorFiltersDrawer, {
  DEFAULT_YEARS_RANGE,
  emptyMentorFilters,
  type MentorFiltersState,
} from "../components/mentors/MentorFiltersDrawer";
import CenteredContent from "../components/ui/CenteredContent";
import PageHero from "../components/ui/PageHero";
import SurfaceCard from "../components/ui/SurfaceCard";
import type { Meeting, MeetingStatus, MentorProfile, MentorsPagination, User } from "../types";

const PAGE_LIMIT = 9;
const SEARCH_DEBOUNCE_MS = 300;

const ACTIVE_MEETING_STATUSES: MeetingStatus[] = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
];

function getMentorUser(profile: MentorProfile) {
  return typeof profile.userId === "string" ? null : profile.userId;
}

function countActiveFilters(filters: MentorFiltersState) {
  let count = 0;
  if (filters.jobTitle.trim()) count += 1;
  if (filters.topics.length > 0) count += 1;
  if (
    filters.yearsRange[0] !== DEFAULT_YEARS_RANGE[0] ||
    filters.yearsRange[1] !== DEFAULT_YEARS_RANGE[1]
  ) {
    count += 1;
  }
  if (filters.availability) count += 1;
  return count;
}

function buildMentorsQuery(params: {
  search: string;
  filters: MentorFiltersState;
  page: number;
  limit: number;
}) {
  const query = new URLSearchParams();
  const { search, filters, page, limit } = params;

  if (search.trim()) {
    query.set("search", search.trim());
  }
  if (filters.jobTitle.trim()) {
    query.set("jobTitle", filters.jobTitle.trim());
  }
  if (filters.topics.length > 0) {
    query.set("topics", filters.topics.join(","));
  }
  if (filters.yearsRange[0] !== DEFAULT_YEARS_RANGE[0]) {
    query.set("minYears", String(filters.yearsRange[0]));
  }
  if (filters.yearsRange[1] !== DEFAULT_YEARS_RANGE[1]) {
    query.set("maxYears", String(filters.yearsRange[1]));
  }
  if (filters.availability) {
    query.set("availability", "true");
  }

  query.set("page", String(page));
  query.set("limit", String(limit));
  return query.toString();
}

export default function MentorsPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [pagination, setPagination] = useState<MentorsPagination>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedMentor, setSelectedMentor] = useState<User | null>(null);
  const [activeMentorIds, setActiveMentorIds] = useState<Set<string>>(new Set());

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MentorFiltersState>(emptyMentorFilters);
  const [draftFilters, setDraftFilters] = useState<MentorFiltersState>(emptyMentorFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Custom 300ms debounce — avoids firing an API call on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev === searchInput) {
          return prev;
        }
        setPage(1);
        return searchInput;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadActiveMeetings = async () => {
      if (!user) {
        setActiveMentorIds(new Set());
        return;
      }

      try {
        const response = await api.get<{ meetings: Meeting[] }>("/meetings/my?role=mentee");
        if (cancelled) {
          return;
        }

        const mentorIds = new Set(
          response.data.meetings
            .filter((meeting) => ACTIVE_MEETING_STATUSES.includes(meeting.status))
            .map((meeting) => meeting.mentorId._id)
        );
        setActiveMentorIds(mentorIds);
      } catch {
        if (!cancelled) {
          // Booking is still blocked by the backend; cards stay enabled as a soft fallback.
          setActiveMentorIds(new Set());
        }
      }
    };

    loadActiveMeetings();
    return () => {
      cancelled = true;
    };
  }, [user, success]);
  useEffect(() => {
    let cancelled = false;

    const loadMentors = async () => {
      setLoading(true);
      setError("");

      try {
        const query = buildMentorsQuery({
          search: debouncedSearch,
          filters,
          page,
          limit: PAGE_LIMIT,
        });
        const response = await api.get<{
          mentors: MentorProfile[];
          pagination: MentorsPagination;
        }>(`/mentors?${query}`);

        if (cancelled) {
          return;
        }

        setMentors(response.data.mentors);
        setPagination(response.data.pagination);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMentors();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, filters, page]);

  const openFilters = () => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
    setFiltersOpen(false);
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setDraftFilters(emptyMentorFilters);
    setFilters(emptyMentorFilters);
    setPage(1);
    setFiltersOpen(false);
  };

  const activeFilterCount = countActiveFilters(filters);
  const totalPages = pagination.totalPages;
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const showPaginationControls = totalPages > 1;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePageChange = (nextPage: number) => {
    const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
    if (clampedPage !== page) {
      setPage(clampedPage);
    }
  };

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <PageHero title="מנטוריות" description="בחרי מנטורית וצפי בזמנים הפנויים שלה." />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <TextField
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="חיפוש לפי שם מנטורית"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant={activeFilterCount > 0 ? "contained" : "outlined"}
          startIcon={<FilterListIcon />}
          onClick={openFilters}
          sx={{ whiteSpace: "nowrap", minWidth: { sm: 140 } }}
        >
          סינון{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 280 }}>
          <CircularProgress />
        </Box>
      ) : mentors.length === 0 ? (
        <SurfaceCard centered sx={{ p: 3 }}>
          <Typography color="text.secondary">לא נמצאו מנטוריות התואמות לחיפוש או לסינון.</Typography>
        </SurfaceCard>
      ) : (
        <>
          <CenteredContent
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
              },
              gap: 2.5,
            }}
          >
            {mentors.map((profile) => {
              const mentor = getMentorUser(profile);
              const isCurrentUser = mentor?._id === user?._id;
              const hasActiveMeeting = Boolean(mentor && activeMentorIds.has(mentor._id));

              return (
                <MentorCard
                  key={profile._id}
                  profile={profile}
                  mentor={mentor}
                  isCurrentUser={isCurrentUser}
                  hasActiveMeeting={hasActiveMeeting}
                  onOpenAvailability={setSelectedMentor}
                />
              );
            })}
          </CenteredContent>

          {showPaginationControls && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                alignItems="center"
                justifyContent="center"
                sx={{ width: "100%" }}
              >
                <Button
                  variant="outlined"
                  disabled={!canGoPrevious}
                  onClick={() => handlePageChange(currentPage - 1)}
                  sx={{ minWidth: { xs: "100%", sm: 104 } }}
                >
                  Previous
                </Button>
                <Pagination
                  color="primary"
                  count={totalPages}
                  page={currentPage}
                  hidePrevButton
                  hideNextButton
                  siblingCount={isSmallScreen ? 0 : 1}
                  boundaryCount={1}
                  size={isSmallScreen ? "small" : "medium"}
                  onChange={(_event, nextPage) => handlePageChange(nextPage)}
                  sx={{
                    "& .MuiPagination-ul": {
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: 0.5,
                    },
                    "& .MuiPaginationItem-root": {
                      fontWeight: 800,
                    },
                  }}
                />
                <Button
                  variant="outlined"
                  disabled={!canGoNext}
                  onClick={() => handlePageChange(currentPage + 1)}
                  sx={{ minWidth: { xs: "100%", sm: 104 } }}
                >
                  Next
                </Button>
              </Stack>
            </Box>
          )}
        </>
      )}

      <MentorFiltersDrawer
        open={filtersOpen}
        draft={draftFilters}
        onClose={() => setFiltersOpen(false)}
        onDraftChange={setDraftFilters}
        onApply={applyFilters}
        onClearFilters={clearAllFilters}
      />

      <MentorAvailabilityModal
        open={Boolean(selectedMentor)}
        mentor={selectedMentor}
        topics={
          mentors.find((profile) => getMentorUser(profile)?._id === selectedMentor?._id)
            ?.topics ?? []
        }
        onClose={() => setSelectedMentor(null)}
        onBooked={() => {
          if (selectedMentor) {
            setActiveMentorIds((prev) => new Set(prev).add(selectedMentor._id));
          }
          setSuccess(`הבקשה נשלחה אל ${selectedMentor?.username}`);
          setSelectedMentor(null);
        }}
      />
    </Stack>
  );
}
