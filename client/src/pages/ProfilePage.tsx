import React, { ChangeEvent, ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import SaveIcon from "@mui/icons-material/Save";
import { api, getApiErrorMessage } from "../api";
import { useAuth } from "../auth/AuthContext";
import TopicSelector from "../components/mentor-profile/TopicSelector";
import StringListEditor from "../components/profile/StringListEditor";
import PageHero from "../components/ui/PageHero";
import SurfaceCard from "../components/ui/SurfaceCard";
import { MENTOR_TOPIC_OPTIONS } from "../constants/mentorTopics";
import type { MentorProfile, User } from "../types";

type ProfileResponse = {
  user: User;
  mentorProfile: MentorProfile | null;
};

type ProfileForm = {
  username: string;
  email: string;
  githubLink: string;
  linkedinLink: string;
  jobTitle: string;
  company: string;
  yearsOfExperience: string;
  background: string;
  maxMeetings: string;
  meetingLength: string;
};

type SectionKey = "picture" | "account" | "password" | "mentor";

type SectionHeaderProps = {
  title: string;
  editing: boolean;
  saving: boolean;
  editDisabled?: boolean;
  saveDisabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

const EMPTY_FORM: ProfileForm = {
  username: "",
  email: "",
  githubLink: "",
  linkedinLink: "",
  jobTitle: "",
  company: "",
  yearsOfExperience: "",
  background: "",
  maxMeetings: "",
  meetingLength: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_IMAGE_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"];
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

function numberToField(value?: number) {
  return value === undefined || value === null ? "" : String(value);
}

function buildForm(user: User, mentorProfile: MentorProfile | null): ProfileForm {
  return {
    username: user.username || "",
    email: user.email || "",
    githubLink: user.githubLink || "",
    linkedinLink: user.linkedinLink || "",
    jobTitle: user.jobTitle || "",
    company: user.company || "",
    yearsOfExperience: numberToField(user.yearsOfExperience),
    background: mentorProfile?.background || "",
    maxMeetings: numberToField(mentorProfile?.maxMeetings),
    meetingLength: numberToField(mentorProfile?.meetingLength),
  };
}

function SectionHeader({
  title,
  editing,
  saving,
  editDisabled = false,
  saveDisabled = false,
  onEdit,
  onCancel,
  onSave,
}: SectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
    >
      <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 900 }}>
        {title}
      </Typography>

      {editing ? (
        <Stack direction="row" spacing={1} justifyContent={{ xs: "stretch", sm: "flex-end" }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={saving || saveDisabled}
            sx={{ minWidth: 104 }}
          >
            {saving ? "שומרת..." : "שמירה"}
          </Button>
          <Button color="inherit" startIcon={<CloseIcon />} onClick={onCancel} disabled={saving}>
            ביטול
          </Button>
        </Stack>
      ) : (
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={onEdit}
          disabled={editDisabled}
          sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        >
          עריכה
        </Button>
      )}
    </Stack>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
}

function DetailItem({ label, value, href }: { label: string; value?: ReactNode; href?: string }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5, color: "primary.dark", fontWeight: 800 }}>
        {label}
      </Typography>
      {href ? (
        <MuiLink href={href} target="_blank" rel="noreferrer" dir="ltr" sx={{ wordBreak: "break-word" }}>
          {href}
        </MuiLink>
      ) : (
        <Typography color={value ? "text.primary" : "text.secondary"} sx={{ wordBreak: "break-word" }}>
          {value || "לא הוזן"}
        </Typography>
      )}
    </Box>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">לא הוזן</Typography>;
  }

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {items.map((item) => (
        <Chip key={item} label={item} size="small" />
      ))}
    </Stack>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [programmingLanguages, setProgrammingLanguages] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState("");
  const [profilePicturePreview, setProfilePicturePreview] = useState("");
  const [profilePictureUpload, setProfilePictureUpload] = useState("");
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [sectionSuccess, setSectionSuccess] = useState<Partial<Record<SectionKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const isMentor = Boolean(mentorProfile);
  const avatarSrc = profilePicturePreview || profilePicture || undefined;

  const setFormValue = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyProfileResponse = (response: ProfileResponse) => {
    setProfileUser(response.user);
    setForm(buildForm(response.user, response.mentorProfile));
    setMentorProfile(response.mentorProfile);
    setProgrammingLanguages(response.user.programmingLanguages || []);
    setTechStack(response.user.techStack || []);
    setTopics(response.mentorProfile?.topics || []);
    setProfilePicture(response.user.profilePicture || "");
    setProfilePicturePreview("");
    setProfilePictureUpload("");
    setRemoveProfilePicture(false);
  };

  useEffect(() => {
    api
      .get<ProfileResponse>("/auth/me/profile")
      .then((response) => applyProfileResponse(response.data))
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const clearSectionMessages = (section: SectionKey) => {
    setSectionErrors((prev) => ({ ...prev, [section]: "" }));
    setSectionSuccess((prev) => ({ ...prev, [section]: "" }));
  };

  const resetSection = (section: SectionKey) => {
    if (!profileUser) {
      return;
    }

    if (section === "account") {
      setForm((prev) => ({
        ...prev,
        username: profileUser.username || "",
        email: profileUser.email || "",
        githubLink: profileUser.githubLink || "",
        linkedinLink: profileUser.linkedinLink || "",
      }));
    }

    if (section === "picture") {
      setProfilePicture(profileUser.profilePicture || "");
      setProfilePicturePreview("");
      setProfilePictureUpload("");
      setRemoveProfilePicture(false);
    }

    if (section === "password") {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    if (section === "mentor") {
      setForm((prev) => ({
        ...prev,
        jobTitle: profileUser.jobTitle || "",
        company: profileUser.company || "",
        yearsOfExperience: numberToField(profileUser.yearsOfExperience),
        background: mentorProfile?.background || "",
        maxMeetings: numberToField(mentorProfile?.maxMeetings),
        meetingLength: numberToField(mentorProfile?.meetingLength),
      }));
      setProgrammingLanguages(profileUser.programmingLanguages || []);
      setTechStack(profileUser.techStack || []);
      setTopics(mentorProfile?.topics || []);
    }
  };

  const beginEdit = (section: SectionKey) => {
    resetSection(section);
    clearSectionMessages(section);
    setEditingSection(section);
  };

  const cancelEdit = (section: SectionKey) => {
    resetSection(section);
    clearSectionMessages(section);
    setEditingSection(null);
  };

  const saveSection = async (
    section: SectionKey,
    payload: Record<string, unknown>,
    successMessage: string,
    afterSave?: () => void
  ) => {
    clearSectionMessages(section);
    setSavingSection(section);

    try {
      const response = await api.patch<ProfileResponse>("/auth/me/profile", payload);
      applyProfileResponse(response.data);
      afterSave?.();
      await refreshUser();
      setEditingSection(null);
      setSectionSuccess((prev) => ({ ...prev, [section]: successMessage }));
    } catch (err) {
      setSectionErrors((prev) => ({ ...prev, [section]: getApiErrorMessage(err) }));
    } finally {
      setSavingSection(null);
    }
  };

  const saveAccountSection = () => {
    if (!form.username.trim()) {
      setSectionErrors((prev) => ({ ...prev, account: "יש למלא שם משתמשת" }));
      return;
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setSectionErrors((prev) => ({ ...prev, account: "יש להזין כתובת מייל תקינה" }));
      return;
    }

    saveSection(
      "account",
      {
        username: form.username,
        email: form.email,
        githubLink: form.githubLink,
        linkedinLink: form.linkedinLink,
      },
      "פרטי החשבון נשמרו בהצלחה"
    );
  };

  const savePasswordSection = () => {
    if (!currentPassword || !newPassword) {
      setSectionErrors((prev) => ({
        ...prev,
        password: "כדי לעדכן סיסמה יש למלא סיסמה נוכחית וסיסמה חדשה",
      }));
      return;
    }

    if (newPassword.length < 6) {
      setSectionErrors((prev) => ({ ...prev, password: "הסיסמה החדשה חייבת להכיל לפחות 6 תווים" }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setSectionErrors((prev) => ({ ...prev, password: "אימות הסיסמה החדשה לא תואם" }));
      return;
    }

    saveSection(
      "password",
      {
        currentPassword,
        newPassword,
      },
      "הסיסמה עודכנה בהצלחה",
      () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    );
  };

  const savePictureSection = () => {
    if (!profilePictureUpload && !removeProfilePicture) {
      setEditingSection(null);
      return;
    }

    saveSection(
      "picture",
      {
        profilePictureUpload: profilePictureUpload || undefined,
        removeProfilePicture,
      },
      "תמונת הפרופיל נשמרה בהצלחה"
    );
  };

  const saveMentorSection = () => {
    if (!isMentor) {
      return;
    }

    saveSection(
      "mentor",
      {
        mentorProfile: {
          background: form.background,
          topics,
          maxMeetings: form.maxMeetings,
          meetingLength: form.meetingLength,
          jobTitle: form.jobTitle,
          company: form.company,
          yearsOfExperience: form.yearsOfExperience,
          programmingLanguages,
          techStack,
        },
      },
      "פרטי המנטורית נשמרו בהצלחה"
    );
  };

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((currentTopic) => currentTopic !== topic) : [...prev, topic]
    );
  };

  const handleProfilePictureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    clearSectionMessages("picture");

    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setSectionErrors((prev) => ({
        ...prev,
        picture: "אפשר להעלות רק תמונות PNG, JPG, WEBP או GIF",
      }));
      return;
    }

    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setSectionErrors((prev) => ({ ...prev, picture: "תמונת הפרופיל חייבת להיות עד 2MB" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfilePicturePreview(reader.result);
        setProfilePictureUpload(reader.result);
        setRemoveProfilePicture(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearProfilePicture = () => {
    setProfilePicture("");
    setProfilePicturePreview("");
    setProfilePictureUpload("");
    setRemoveProfilePicture(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", minHeight: 280, placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <PageHero
        title="אזור אישי"
        description={user?.username ? `${user.username}, הפרטים שלך במקום אחד` : undefined}
      />

      {loadError && <Alert severity="error">{loadError}</Alert>}

      <SurfaceCard centered sx={{ p: { xs: 2, md: 3 }, maxWidth: 1040 }}>
        <Stack spacing={3.25}>
          <Box component="section">
            <Stack spacing={2}>
              <SectionHeader
                title="תמונת פרופיל"
                editing={editingSection === "picture"}
                saving={savingSection === "picture"}
                editDisabled={Boolean(editingSection)}
                onEdit={() => beginEdit("picture")}
                onCancel={() => cancelEdit("picture")}
                onSave={savePictureSection}
              />

              {sectionErrors.picture && <Alert severity="error">{sectionErrors.picture}</Alert>}
              {sectionSuccess.picture && <Alert severity="success">{sectionSuccess.picture}</Alert>}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Avatar
                  src={avatarSrc}
                  sx={{
                    width: 128,
                    height: 128,
                    color: "#ffffff",
                    background: "linear-gradient(135deg, #ec407a 0%, #ea95b7 100%)",
                    border: "2px solid #f8bbd0",
                    fontSize: 44,
                    fontWeight: 900,
                  }}
                >
                  {form.username?.[0]}
                </Avatar>

                {editingSection === "picture" ? (
                  <Stack spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
                    <Button variant="outlined" component="label" startIcon={<PhotoCameraIcon />}>
                      החלפת תמונה
                      <Box
                        component="input"
                        type="file"
                        accept={PROFILE_IMAGE_TYPES.join(",")}
                        onChange={handleProfilePictureChange}
                        sx={{ display: "none" }}
                      />
                    </Button>

                    {(profilePicture || profilePicturePreview) && (
                      <Button color="inherit" startIcon={<DeleteIcon />} onClick={clearProfilePicture}>
                        הסרת תמונה
                      </Button>
                    )}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">
                    {profilePicture ? "קיימת תמונת פרופיל שמורה" : "לא הועלתה תמונת פרופיל"}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Box>

          <Divider />

          <Box component="section">
            <Stack spacing={2}>
              <SectionHeader
                title="פרטי חשבון"
                editing={editingSection === "account"}
                saving={savingSection === "account"}
                editDisabled={Boolean(editingSection)}
                onEdit={() => beginEdit("account")}
                onCancel={() => cancelEdit("account")}
                onSave={saveAccountSection}
              />

              {sectionErrors.account && <Alert severity="error">{sectionErrors.account}</Alert>}
              {sectionSuccess.account && <Alert severity="success">{sectionSuccess.account}</Alert>}

              {editingSection === "account" ? (
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="שם משתמשת"
                      value={form.username}
                      onChange={(event) => setFormValue("username", event.target.value)}
                      required
                      fullWidth
                    />
                    <TextField
                      label="מייל"
                      type="email"
                      value={form.email}
                      onChange={(event) => setFormValue("email", event.target.value)}
                      required
                      fullWidth
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="LinkedIn"
                      type="url"
                      value={form.linkedinLink}
                      onChange={(event) => setFormValue("linkedinLink", event.target.value)}
                      placeholder="https://www.linkedin.com/in/..."
                      fullWidth
                    />
                    <TextField
                      label="GitHub"
                      type="url"
                      value={form.githubLink}
                      onChange={(event) => setFormValue("githubLink", event.target.value)}
                      placeholder="https://github.com/..."
                      fullWidth
                    />
                  </Stack>
                </Stack>
              ) : (
                <DetailGrid>
                  <DetailItem label="שם משתמשת" value={form.username} />
                  <DetailItem label="מייל" value={form.email} />
                  <DetailItem label="LinkedIn" href={form.linkedinLink || undefined} />
                  <DetailItem label="GitHub" href={form.githubLink || undefined} />
                </DetailGrid>
              )}
            </Stack>
          </Box>

          <Divider />

          <Box component="section">
            <Stack spacing={2}>
              <SectionHeader
                title="שינוי סיסמה"
                editing={editingSection === "password"}
                saving={savingSection === "password"}
                editDisabled={Boolean(editingSection)}
                onEdit={() => beginEdit("password")}
                onCancel={() => cancelEdit("password")}
                onSave={savePasswordSection}
              />

              {sectionErrors.password && <Alert severity="error">{sectionErrors.password}</Alert>}
              {sectionSuccess.password && <Alert severity="success">{sectionSuccess.password}</Alert>}

              {editingSection === "password" ? (
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="סיסמה נוכחית"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="סיסמה חדשה"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    helperText="לפחות 6 תווים"
                    fullWidth
                  />
                  <TextField
                    label="אימות סיסמה חדשה"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    fullWidth
                  />
                </Stack>
              ) : (
                <Typography color="text.secondary">הסיסמה לא מוצגת מטעמי אבטחה.</Typography>
              )}
            </Stack>
          </Box>

          {isMentor && (
            <>
              <Divider />

              <Box component="section">
                <Stack spacing={2.5}>
                  <SectionHeader
                    title="פרטי מנטורית"
                    editing={editingSection === "mentor"}
                    saving={savingSection === "mentor"}
                    editDisabled={Boolean(editingSection)}
                    onEdit={() => beginEdit("mentor")}
                    onCancel={() => cancelEdit("mentor")}
                    onSave={saveMentorSection}
                  />

                  {sectionErrors.mentor && <Alert severity="error">{sectionErrors.mentor}</Alert>}
                  {sectionSuccess.mentor && <Alert severity="success">{sectionSuccess.mentor}</Alert>}

                  {editingSection === "mentor" ? (
                    <Stack spacing={2.5}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          label="תפקיד / תחום מקצועי"
                          value={form.jobTitle}
                          onChange={(event) => setFormValue("jobTitle", event.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="חברה"
                          value={form.company}
                          onChange={(event) => setFormValue("company", event.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="שנות ניסיון"
                          type="number"
                          value={form.yearsOfExperience}
                          onChange={(event) => setFormValue("yearsOfExperience", event.target.value)}
                          inputProps={{ min: 0 }}
                          fullWidth
                        />
                      </Stack>

                      <TextField
                        label="רקע קצר / ביו"
                        value={form.background}
                        onChange={(event) => setFormValue("background", event.target.value)}
                        multiline
                        minRows={4}
                        fullWidth
                      />

                      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <TextField
                          label="מספר פגישות מקסימלי"
                          type="number"
                          value={form.maxMeetings}
                          onChange={(event) => setFormValue("maxMeetings", event.target.value)}
                          inputProps={{ min: 1 }}
                          fullWidth
                        />
                        <TextField
                          label="אורך פגישה בדקות"
                          type="number"
                          value={form.meetingLength}
                          onChange={(event) => setFormValue("meetingLength", event.target.value)}
                          inputProps={{ min: 1 }}
                          fullWidth
                        />
                      </Stack>

                      <StringListEditor
                        label="שפות תכנות"
                        value={programmingLanguages}
                        onChange={setProgrammingLanguages}
                        placeholder="JavaScript, Python..."
                      />

                      <StringListEditor
                        label="טכנולוגיות"
                        value={techStack}
                        onChange={setTechStack}
                        placeholder="React, Node.js..."
                      />

                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1.5, color: "primary.dark", fontWeight: 800 }}>
                          תחומים למנטורינג
                        </Typography>
                        <TopicSelector options={MENTOR_TOPIC_OPTIONS} selectedTopics={topics} onToggle={toggleTopic} />
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={2}>
                      <DetailGrid>
                        <DetailItem label="תפקיד / תחום מקצועי" value={form.jobTitle} />
                        <DetailItem label="חברה" value={form.company} />
                        <DetailItem label="שנות ניסיון" value={form.yearsOfExperience} />
                        <DetailItem label="מספר פגישות מקסימלי" value={form.maxMeetings} />
                        <DetailItem label="אורך פגישה בדקות" value={form.meetingLength} />
                      </DetailGrid>

                      <DetailItem label="רקע קצר / ביו" value={form.background} />

                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: "primary.dark", fontWeight: 800 }}>
                          שפות תכנות
                        </Typography>
                        <ChipList items={programmingLanguages} />
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: "primary.dark", fontWeight: 800 }}>
                          טכנולוגיות
                        </Typography>
                        <ChipList items={techStack} />
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: "primary.dark", fontWeight: 800 }}>
                          תחומים למנטורינג
                        </Typography>
                        <ChipList items={topics} />
                      </Box>
                    </Stack>
                  )}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </SurfaceCard>
    </Stack>
  );
}
