package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.shoppingai.adapter.repository.IConversationRepository;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ConversationTurnVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.domain.shoppingai.service.impl.ConversationServiceImpl;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ConversationActivityTest {

    private final Instant now = Instant.parse("2026-11-07T00:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);

    @Test
    void successfulTurnStoresUserSummaryAndActivityAfterBothMessages() {
        var repository = mock(IConversationRepository.class);
        var turn = new ConversationTurnVO("conversation", "buyer", "token");
        when(repository.finishTurn(turn)).thenReturn(true);
        when(repository.updateActivity("conversation", "buyer", now, "预算 20 元 买两瓶")).thenReturn(true);

        new ConversationServiceImpl(repository, clock).appendTurn(turn, "  预算  20 元\n买两瓶  ", "回答", "scope-fingerprint");

        var messages = ArgumentCaptor.forClass(MessageVO.class);
        verify(repository, times(2)).append(messages.capture());
        assertEquals(List.of("user", "assistant"), messages.getAllValues().stream().map(MessageVO::role).toList());
        assertEquals(now, messages.getAllValues().get(0).createdAt());
        assertEquals(now, messages.getAllValues().get(1).createdAt());
        verify(repository).updateActivity("conversation", "buyer", now, "预算 20 元 买两瓶");
    }

    @Test
    void failedActivityUpdateIsRejectedAndCannotBeSilentlyIgnored() {
        var repository = mock(IConversationRepository.class);
        var turn = new ConversationTurnVO("conversation", "buyer", "token");
        when(repository.finishTurn(turn)).thenReturn(true);
        when(repository.updateActivity(eq("conversation"), eq("buyer"), eq(now), anyString())).thenReturn(false);

        var failure = assertThrows(cn.bugstack.ai.types.exception.AppException.class, () ->
            new ConversationServiceImpl(repository, clock).appendTurn(turn, "问题", "回答", "scope")
        );

        assertEquals("G0002", failure.getCode());
    }

    @Test
    void conversationPagingUsesOwnerOffsetWithoutLoadingEachConversationMessages() {
        var repository = mock(IConversationRepository.class);
        when(repository.conversations("buyer", 40, 20)).thenReturn(List.of());

        assertTrue(new ConversationServiceImpl(repository, clock).conversations("buyer", 3, 20).isEmpty());

        verify(repository).conversations("buyer", 40, 20);
        verify(repository, never()).messages(anyString(), anyInt());
    }
}
