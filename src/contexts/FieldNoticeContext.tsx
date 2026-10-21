import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldAlertModal } from "@/components/design/FieldAlertModal";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type NoticeOptions = {
  eyebrow?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/** 세 갈래 선택 결과. 바깥을 누르거나 뒤로가기로 닫으면 "cancel". */
export type NoticeChoice = "confirm" | "secondary" | "cancel";

type ChoiceOptions = NoticeOptions & {
  /** 확인과 취소 사이에 들어가는 두 번째 행동(예: 삭제). */
  secondaryLabel: string;
  secondaryDestructive?: boolean;
};

type ActiveNotice = NoticeOptions & {
  kind: "alert" | "confirm" | "choose";
  secondaryLabel?: string;
  secondaryDestructive?: boolean;
  resolve: (result: NoticeChoice) => void;
};

type ToastOptions = {
  message: string;
  tone?: "default" | "success" | "error";
};

type FieldNoticeContextValue = {
  alert: (options: NoticeOptions) => Promise<void>;
  confirm: (options: NoticeOptions) => Promise<boolean>;
  choose: (options: ChoiceOptions) => Promise<NoticeChoice>;
  toast: (options: ToastOptions | string) => void;
};

const FieldNoticeContext = createContext<FieldNoticeContextValue | null>(null);

export const FieldNoticeProvider = ({ children }: PropsWithChildren) => {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<ActiveNotice | null>(null);
  const noticeRef = useRef<ActiveNotice | null>(null);
  const [toastNotice, setToastNotice] = useState<ToastOptions | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<ActiveNotice[]>([]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    noticeRef.current?.resolve("cancel");
    noticeRef.current = null;
    queueRef.current.splice(0).forEach((queued) => queued.resolve("cancel"));
  }, []);

  // 확인창이 떠 있는 동안 다른 알림이 오면, 예전에는 확인창을 false로 끝내 버려
  // 사용자가 누르지도 않은 "취소"가 됐다. 지금은 뒤에 줄을 세웠다가 차례로 띄운다.
  const presentNotice = useCallback((next: ActiveNotice) => {
    if (noticeRef.current) {
      queueRef.current.push(next);
      return;
    }
    noticeRef.current = next;
    setNotice(next);
  }, []);

  const alert = useCallback((options: NoticeOptions) =>
    new Promise<void>((resolve) => {
      presentNotice({
        ...options,
        kind: "alert",
        resolve: () => resolve(),
      });
    }), [presentNotice]);

  const confirm = useCallback((options: NoticeOptions) =>
    new Promise<boolean>((resolve) => {
      presentNotice({ ...options, kind: "confirm", resolve: (result) => resolve(result === "confirm") });
    }), [presentNotice]);

  const choose = useCallback((options: ChoiceOptions) =>
    new Promise<NoticeChoice>((resolve) => {
      presentNotice({ ...options, kind: "choose", resolve });
    }), [presentNotice]);

  const closeNotice = useCallback((result: NoticeChoice) => {
    const current = noticeRef.current;
    const next = queueRef.current.shift() ?? null;
    noticeRef.current = next;
    setNotice(next);
    current?.resolve(result);
  }, []);

  const toast = useCallback((options: ToastOptions | string) => {
    const next = typeof options === "string" ? { message: options } : options;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastNotice(next);
    toastTimer.current = setTimeout(() => setToastNotice(null), 2600);
  }, []);

  const value = useMemo(() => ({ alert, confirm, choose, toast }), [alert, choose, confirm, toast]);
  const toastColor = toastNotice?.tone === "error"
    ? FIELD_COLORS.orange
    : toastNotice?.tone === "success"
      ? FIELD_COLORS.teal
      : FIELD_COLORS.ink;

  return (
    <FieldNoticeContext.Provider value={value}>
      {children}
      <FieldAlertModal
        visible={Boolean(notice)}
        eyebrow={notice?.eyebrow}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        confirmLabel={notice?.confirmLabel}
        cancelLabel={notice?.cancelLabel}
        destructive={notice?.destructive}
        secondaryLabel={notice?.kind === "choose" ? notice.secondaryLabel : undefined}
        secondaryDestructive={notice?.secondaryDestructive}
        onClose={() => closeNotice("cancel")}
        onConfirm={notice && notice.kind !== "alert" ? () => closeNotice("confirm") : undefined}
        onSecondary={notice?.kind === "choose" ? () => closeNotice("secondary") : undefined}
      />
      {toastNotice ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          className="absolute left-5 right-5 flex-row items-center border bg-white px-4 py-3"
          style={{
            bottom: insets.bottom + 84,
            borderColor: FIELD_COLORS.ink,
            shadowColor: FIELD_COLORS.ink,
            shadowOffset: { width: 4, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 0,
            elevation: 8,
            zIndex: 1000,
          }}
        >
          <View className="mr-3 h-2 w-2" style={{ backgroundColor: toastColor }} />
          <Text
            className="flex-1 text-[13px] leading-5"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            {toastNotice.message}
          </Text>
          <Text className="text-[9px] tracking-[1px]" style={{ color: toastColor, fontFamily: monoFont }}>
            NOTICE
          </Text>
        </View>
      ) : null}
    </FieldNoticeContext.Provider>
  );
};

export const useFieldNotice = () => {
  const context = useContext(FieldNoticeContext);
  if (!context) {
    throw new Error("useFieldNotice must be used within FieldNoticeProvider");
  }
  return context;
};
