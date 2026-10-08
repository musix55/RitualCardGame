// 画面の上に重ねて出す選択・確認の枠（Alert はブラウザ版で動かないため自前で用意する）

import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface DialogButton {
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
  readonly disabled?: boolean;
}

interface Props {
  readonly visible: boolean;
  readonly title: string;
  readonly children?: ReactNode;
  readonly buttons: readonly DialogButton[];
}

export function Dialog({ visible, title, children, buttons }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
          <View style={styles.buttons}>
            {buttons.map((b) => (
              <Button key={b.label} {...b} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Button({ label, onPress, primary = false, disabled = false }: DialogButton) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary && styles.primary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  box: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', maxWidth: 480, maxHeight: '90%' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  body: { flexGrow: 0 },
  bodyContent: { gap: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  button: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#888' },
  primary: { backgroundColor: '#4a3aa8', borderColor: '#4a3aa8' },
  disabled: { opacity: 0.35 },
  buttonText: { fontSize: 15 },
  primaryText: { color: '#fff', fontWeight: 'bold' },
});
